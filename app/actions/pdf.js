'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { extractText, getDocumentProxy } from 'unpdf'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

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

    const pdf = await getDocumentProxy(uint8Array)
    const { text: extractedText } = await extractText(pdf, { mergePages: true })

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

    // ✅ Link this PDF to the session
    await supabase.from('session_documents').insert([{
      session_id: sessionId,
      document_id: docData.id
    }])

    const chunks = chunkText(extractedText)
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const chunkRecords = []

    for (let i = 0; i < chunks.length; i++) {
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