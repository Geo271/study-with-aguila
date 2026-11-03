'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { extractText, getDocumentProxy } from 'unpdf'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Buffer } from 'buffer'
import mammoth from 'mammoth'
import { generateTopicTitle } from './chat'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function chunkText(text, chunkSize = 1800, overlap = 150) {
  if (!text) return []
  const chunks = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize))
    i += (chunkSize - overlap)
  }
  return chunks
}

/**
 * High-speed batched embedding generator:
 * Uses text-embedding-004 batchEmbedContents for 1-call processing
 * with instant fallback if API key is unconfigured or rate-limited
 */
async function generateEmbeddingsForChunks(chunks, docId) {
  const chunkRecords = []

  if (process.env.GEMINI_API_KEY && chunks.length > 0) {
    try {
      const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
      const batchSize = 25 // Batch up to 25 chunks in a single API call

      for (let b = 0; b < chunks.length; b += batchSize) {
        const slice = chunks.slice(b, b + batchSize)
        const batchRes = await embeddingModel.batchEmbedContents({
          requests: slice.map(chunk => ({
            content: { role: 'user', parts: [{ text: chunk }] },
            outputDimensionality: 768,
          }))
        })
        const embeddings = batchRes.embeddings || []
        slice.forEach((chunk, idx) => {
          chunkRecords.push({
            document_id: docId,
            content: chunk,
            chunk_index: b + idx,
            embedding: embeddings[idx]?.values || null,
          })
        })
      }
    } catch (e) {
      console.warn('Fast batch embedding skipped/fallback:', e.message)
    }
  }

  // Fallback: If embeddings failed or no key, store chunks with null embedding so full-text search works immediately!
  if (chunkRecords.length === 0) {
    chunks.forEach((chunk, idx) => {
      chunkRecords.push({
        document_id: docId,
        content: chunk,
        chunk_index: idx,
        embedding: null,
      })
    })
  }

  return chunkRecords
}

// ✅ Creates a named study session
export async function createSession(userId, title = 'New Session') {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert([{ user_id: userId, title }])
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, session: data }
}

// ✅ Accepts sessionId and links PDF to session with auto-topic renaming
export async function processPDF(formData, userId, sessionId) {
  try {
    const file = formData.get('file')
    if (!file) throw new Error('No file uploaded')

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `${Date.now()}-${safeName}`
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Parallelize storage upload and text extraction for maximum speed
    const uploadPromise = supabase.storage.from('pdfs').upload(fileName, file)

    const extractPromise = (async () => {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const buffer = Buffer.from(arrayBuffer)
        const result = await mammoth.extractRawText({ buffer })
        return result.value || ''
      } else {
        const pdf = await getDocumentProxy(uint8Array)
        const extractResult = await extractText(pdf, { mergePages: true })
        return extractResult.text || ''
      }
    })()

    const [{ data: storageData, error: storageError }, extractedText] = await Promise.all([
      uploadPromise,
      extractPromise,
    ])

    if (storageError) throw new Error(`Storage error: ${storageError.message}`)

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{
        file_name: file.name,
        file_path: storageData.path,
        subject: 'General',
        user_id: userId
      }])
      .select()
      .single()
    if (docError) throw new Error(`Database error: ${docError.message}`)

    if (sessionId) {
      await supabase.from('session_documents').insert([{
        session_id: sessionId,
        document_id: docData.id,
      }])
    }

    const chunks = chunkText(extractedText, 1800, 150)
    const chunkRecords = await generateEmbeddingsForChunks(chunks, docData.id)

    const { error: chunkDbError } = await supabase
      .from('document_chunks').insert(chunkRecords)
    if (chunkDbError) throw new Error(`Vector DB error: ${chunkDbError.message}`)

    // Auto-rename session context based on extracted material topic
    let topicTitle = null
    if (sessionId && extractedText) {
      try {
        topicTitle = await generateTopicTitle(`${file.name}\n${extractedText.slice(0, 1000)}`)
        if (topicTitle) {
          await supabase.from('study_sessions').update({ title: topicTitle }).eq('id', sessionId)
        }
      } catch (titleErr) {
        console.warn('Auto-rename session failed in processPDF:', titleErr.message)
      }
    }

    return { 
      success: true, 
      documentId: docData.id, 
      totalChunks: chunks.length,
      extractedText,
      topicTitle,
    }
  } catch (error) {
    console.error('PDF Processing Error:', error)
    return { success: false, error: error.message }
  }
}

export async function processOCR(formData, userId, sessionId) {
  try {
    const file = formData.get('file')
    if (!file) throw new Error('No image uploaded')

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      throw new Error('Please upload a JPG, PNG, or WEBP image.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const ocrResult = await visionModel.generateContent([
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      },
      {
        text: `Transcribe all handwritten or printed text from this image as accurately as possible. 
Preserve the layout, headings, bullet points, and numbered lists where possible.
Output ONLY the transcribed text. Do not add any introductory or concluding comments.`
      }
    ])

    const extractedText = ocrResult.response.text().trim()
    if (!extractedText) throw new Error('No text could be extracted from this image.')

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `${Date.now()}-${safeName}`

    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('pdfs')
      .upload(fileName, file)

    if (storageError) throw new Error(`Storage upload error: ${storageError.message}`)

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{
        file_name: `[OCR] ${file.name}`,
        file_path: storageData.path,
        subject: 'General',
        user_id: userId,
      }])
      .select()
      .single()

    if (docError) throw new Error(`Database error: ${docError.message}`)

    if (sessionId) {
      await supabase.from('session_documents').insert([{
        session_id: sessionId,
        document_id: docData.id,
      }])
    }

    const chunks = chunkText(extractedText, 1800, 150)
    const chunkRecords = await generateEmbeddingsForChunks(chunks, docData.id)

    const { error: chunkDbError } = await supabase.from('document_chunks').insert(chunkRecords)
    if (chunkDbError) throw new Error(`Vector DB error: ${chunkDbError.message}`)

    // Auto-rename session context based on transcribed notes topic
    let topicTitle = null
    if (sessionId && extractedText) {
      try {
        topicTitle = await generateTopicTitle(extractedText.slice(0, 1000))
        if (topicTitle) {
          await supabase.from('study_sessions').update({ title: topicTitle }).eq('id', sessionId)
        }
      } catch (titleErr) {
        console.warn('Auto-rename session failed in processOCR:', titleErr.message)
      }
    }

    return {
      success: true,
      documentId: docData.id,
      totalChunks: chunks.length,
      extractedText,
      charCount: extractedText.length,
      topicTitle,
    }
  } catch (error) {
    console.error('OCR Error:', error)
    return { success: false, error: error.message }
  }
}

export async function uploadChatFile(formData) {
  try {
    const file = formData.get('file')
    if (!file) throw new Error("No file received.")

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `chat/${Date.now()}-${safeName}`

    const { error } = await supabase.storage.from('pdfs').upload(fileName, file)
    if (error) throw new Error(error.message)

    const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(fileName)
    return { success: true, publicUrl }
  } catch (error) {
    console.error("Chat Upload Error:", error)
    return { success: false, error: error.message }
  }
}
