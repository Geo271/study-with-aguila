'use server'

import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function askDocument(question, documentId, userId) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const embeddingResult = await embeddingModel.embedContent({
      content: { role: 'user', parts: [{ text: question }] },
      outputDimensionality: 768
    })
    const queryEmbedding = embeddingResult.embedding.values

    let { data: chunks, error: searchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 6
    })

    if (searchError) throw new Error(`Search failed: ${searchError.message}`)

    if (!chunks || chunks.length === 0) {
      const { data: fallbackChunks } = await supabase
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })
        .limit(8)
      chunks = fallbackChunks || []
    }

    const contextText = chunks.map(c => c.content).join('\n\n')

    const systemPrompt = `
      You are an expert Study Tutor. Answer based on the student's PDF notes below.
      
      CONTEXT FROM PDF:
      "${contextText}"

      USER REQUEST: "${question}"

      INSTRUCTIONS:
      1. If factual question → answer clearly from the context.
      2. If asking to summarize → provide a clean bulleted summary.
      3. If context is empty → politely ask them to clarify.
      Keep answers concise and student-friendly.
    `

    const result = await textModel.generateContent(systemPrompt)
    const text = result.response.text()

    // Save both messages to chat history
    await supabase.from('chat_messages').insert([
      { document_id: documentId, user_id: userId, role: 'user', content: question },
      { document_id: documentId, user_id: userId, role: 'ai', content: text }
    ])

    return { success: true, answer: text }
  } catch (error) {
    console.error('Chat Error:', error)
    return { success: false, error: error.message }
  }
}