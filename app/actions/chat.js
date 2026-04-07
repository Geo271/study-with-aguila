'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function askDocument(question, sessionId, userId) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Get all document IDs linked to this session
    const { data: sessionDocs } = await supabase
      .from('session_documents')
      .select('document_id')
      .eq('session_id', sessionId)

    const docIds = sessionDocs?.map(d => d.document_id) || []

    const embeddingResult = await embeddingModel.embedContent({
      content: { role: 'user', parts: [{ text: question }] },
      outputDimensionality: 768
    })
    const queryEmbedding = embeddingResult.embedding.values

    let { data: chunks, error: searchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 8
    })

    if (searchError) throw new Error(`Search failed: ${searchError.message}`)

    if (!chunks || chunks.length === 0) {
      const { data: fallbackChunks } = await supabase
        .from('document_chunks')
        .select('content')
        .in('document_id', docIds)
        .order('chunk_index', { ascending: true })
        .limit(10)
      chunks = fallbackChunks || []
    }

    const contextText = chunks.map(c => c.content).join('\n\n')

    const systemPrompt = `
You are Aguila, an expert academic tutor and study coach. Your role is to help students deeply understand their course material using their uploaded PDF notes.

CONTEXT FROM STUDENT'S NOTES:
"""
${contextText}
"""

STUDENT'S QUESTION: "${question}"

RESPONSE GUIDELINES:
1. ACCURACY — Only answer based on the provided context. Never fabricate information.
2. STRUCTURE — Always format your response clearly:
   - Use short paragraphs (2-3 sentences max each)
   - Use bullet points for lists, steps, or comparisons
   - Use bold (**text**) to highlight key terms or concepts
   - Add a line break between sections for readability
3. DEPTH — Don't just define. Explain the "why" and "how" behind concepts.
4. STUDENT-FRIENDLY — Use clear, academic language. Avoid jargon unless the notes use it, in which case explain it.
5. CLOSING — End every response with one of these based on context:
   - A quick "💡 Key takeaway:" summary (for concept explanations)
   - A "🧠 Try to recall:" prompt (for memorization topics)
   - A "📌 Related topic to review:" suggestion (for connected ideas)

SPECIAL COMMANDS:
- If asked to "summarize" → Provide a structured summary with: Overview, Key Points (bulleted), and Important Terms
- If asked to "explain like I'm 5" → Use simple analogies and everyday language
- If context is insufficient → Say exactly: "I couldn't find enough detail about that in your notes. Try asking about [suggest a related topic from context]."

Never say "Based on the context provided" or "According to the PDF". Just answer naturally as a knowledgeable tutor.
    `

    let text = "";
    
    try {
      const result = await textModel.generateContent(systemPrompt)
      text = result.response.text()
    } catch (aiError) {
      console.error('Gemini API Error:', aiError)
      
      if (aiError.status === 429 || aiError.message.includes('429') || aiError.message.includes('quota')) {
        text = "Aguila is feeling a bit overwhelmed with so many students right now! 🦅 Please wait about 10 seconds and try asking again."
      } else {
        text = "Oops! Aguila's brain had a minor hiccup trying to read that. Please try asking again."
      }
    }

    // Save the AI response and the user question to your database
    await supabase.from('chat_messages').insert([
      { session_id: sessionId, user_id: userId, role: 'user', content: question },
      { session_id: sessionId, user_id: userId, role: 'ai', content: text }
    ])

    return { success: true, answer: text }

  } catch (error) {
    console.error('Chat Error:', error)
    return { success: false, error: error.message }
  }
}

export async function archiveSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ is_archived: true })
    .eq('id', sessionId)
  return { success: !error }
}

export async function getSessions(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`*, session_documents(document_id, documents(file_name))`)
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, sessions: data }
}

// ✅ HERE IS THE MISSING FUNCTION THAT LOADS CHAT HISTORY!
export async function getChatHistory(sessionId) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return { success: true, messages: data }
  } catch (error) {
    console.error('Failed to fetch chat history:', error)
    return { success: false, error: error.message }
  }
}