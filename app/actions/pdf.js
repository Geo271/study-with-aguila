'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { extractText, getDocumentProxy } from 'unpdf'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Buffer } from 'buffer'
import mammoth from 'mammoth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize))
    i += (chunkSize - overlap)
  }
  return chunks
}

// ✅ NEW — creates a named study session
export async function createSession(userId, title = 'New Session') {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert([{ user_id: userId, title }])
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  return { success: true, session: data }
}

// ✅ UPDATED — now accepts sessionId and links PDF to session
export async function processPDF(formData, userId, sessionId) {
  try {
    const file = formData.get('file')
    if (!file) throw new Error('No file uploaded')

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `${Date.now()}-${safeName}`
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const { data: storageData, error: storageError } = await supabase
      .storage.from('pdfs').upload(fileName, file)
    if (storageError) throw new Error(`Storage error: ${storageError.message}`)

    // 🌟 SMART EXTRACTION: Check the file extension and use the right reader!
    let extractedText = ''
    
    if (file.name.toLowerCase().endsWith('.docx')) {
      // Use Mammoth for Word Documents
      const buffer = Buffer.from(arrayBuffer)
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else {
      // Use unpdf for standard PDFs
      const pdf = await getDocumentProxy(uint8Array)
      const extractResult = await extractText(pdf, { mergePages: true })
      extractedText = extractResult.text
    }

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

    // Link to session if one was provided (lounge uploads pass null — that is fine)
    if (sessionId) {
      await supabase.from('session_documents').insert([{
        session_id: sessionId,
        document_id: docData.id,
      }])
    }

    const chunks = chunkText(extractedText)
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const chunkRecords = []

   for (let i = 0; i < chunks.length; i++) {
      
      // 🛑 THE THROTTLE: Pause for 1 second (1000ms) before each request
      await delay(1000);

      const result = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: chunks[i] }] },
        outputDimensionality: 768
      })
      
      chunkRecords.push({
        document_id: docData.id,
        content: chunks[i],
        chunk_index: i,
        embedding: result.embedding.values
      })
    }

    const { error: chunkDbError } = await supabase
      .from('document_chunks').insert(chunkRecords)
    if (chunkDbError) throw new Error(`Vector DB error: ${chunkDbError.message}`)

    return { success: true, documentId: docData.id, totalChunks: chunks.length }
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
 
    // Convert image to base64 for Gemini Vision
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
 
    // Use Gemini Vision to extract text (handles handwriting perfectly)
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const visionResult = await visionModel.generateContent([
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      },
      `Extract ALL text from this image with complete accuracy.
If the text is handwritten, transcribe it exactly as written, preserving:
- All headings and subheadings
- Bullet points and numbered lists  
- Diagrams with their labels
- Any underlined or circled key terms
- Tables and their contents
Output ONLY the extracted text. No commentary, no "Here is the text:", just the content itself.`,
    ])
 
    const extractedText = visionResult.response.text()
    if (!extractedText.trim()) throw new Error('No text could be detected in this image.')
 
    // Save as a document record (no physical file stored for OCR images)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{
        file_name: `[Scan] ${file.name}`,
        file_path: `ocr/${Date.now()}-${safeName}`,
        subject: 'OCR Scan',
        user_id: userId,
      }])
      .select().single()
    if (docError) throw new Error(`Database error: ${docError.message}`)
 
    // Link to the session
    await supabase.from('session_documents').insert([{
      session_id: sessionId,
      document_id: docData.id,
    }])
 
    // Chunk and embed exactly like a normal PDF
    const chunks = chunkText(extractedText)
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const chunkRecords = []
 
    for (let i = 0; i < chunks.length; i++) {
      await delay(1000)
      const result = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: chunks[i] }] },
        outputDimensionality: 768,
      })
      chunkRecords.push({
        document_id: docData.id,
        content: chunks[i],
        chunk_index: i,
        embedding: result.embedding.values,
      })
    }
 
    const { error: chunkDbError } = await supabase.from('document_chunks').insert(chunkRecords)
    if (chunkDbError) throw new Error(`Vector DB error: ${chunkDbError.message}`)
 
    return {
      success: true,
      documentId: docData.id,
      totalChunks: chunks.length,
      extractedText,
      charCount: extractedText.length,
    }
  } catch (error) {
    console.error('OCR Error:', error)
    return { success: false, error: error.message }
  }
}

// Add this to the very bottom of app/actions/pdf.js

export async function uploadChatFile(formData) {
  try {
    const file = formData.get('file')
    if (!file) throw new Error("No file received.")

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileName = `chat/${Date.now()}-${safeName}`

    // Upload using supabaseAdmin (bypasses RLS security blocks)
    const { error } = await supabase.storage.from('pdfs').upload(fileName, file)
    if (error) throw new Error(error.message)

    const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(fileName)
    return { success: true, publicUrl }
  } catch (error) {
    console.error("Chat Upload Error:", error)
    return { success: false, error: error.message }
  }
}