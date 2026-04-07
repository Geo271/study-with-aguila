'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

export async function askDocument(question, sessionId, userId) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

    const { data: sessionDocs } = await supabase
      .from('session_documents')
      .select('document_id')
      .eq('session_id', sessionId)

    const docIds = sessionDocs?.map(d => d.document_id) || []
    let contextText = ''

    const isBroadRequest = /quiz|question|summarize|summary|notes|explain/i.test(question)

    if (isBroadRequest) {
      const { data: directChunks } = await supabase
        .from('document_chunks')
        .select('content')
        .in('document_id', docIds)
        .order('chunk_index', { ascending: true })
      contextText = directChunks?.map(c => c.content).join('\n\n') || ''
    } else {
      const embeddingResult = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: question }] },
        outputDimensionality: 768
      })
      const queryEmbedding = embeddingResult.embedding.values

      let { data: chunks } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count: 50
      })

      if (chunks && chunks.length > 0) {
        chunks = chunks.filter(c => docIds.includes(c.document_id)).slice(0, 10)
      }

      if (!chunks || chunks.length === 0) {
        const { data: fallback } = await supabase
          .from('document_chunks')
          .select('content')
          .in('document_id', docIds)
          .order('chunk_index', { ascending: true })
          .limit(10)
        chunks = fallback || []
      }
      contextText = chunks.map(c => c.content).join('\n\n')
    }

    const finalPrompt = `CONTEXT FROM CURRENT NOTES:\n"""\n${contextText}\n"""\n\nSTUDENT QUESTION: "${question}"`

    let text = ''
    try {
      const completion = await openai.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: `You are Aguila, an expert academic tutor. You MUST base your answers STRICTLY on the provided context. Never use outside knowledge.
            
CRITICAL RULE REGARDING QUIZZES: 
- If the user asks for advice or topics *about* a quiz (e.g., "what should I focus on for my quiz?"), answer them normally in text.
- ONLY if the user explicitly asks you to GENERATE, START, or CREATE a quiz right now, you must NOT write questions in chat. Instead, reply EXACTLY with this secret code: [TRIGGER_QUIZ: X] (where X is the number of questions).
                                          
RESPONSE GUIDELINES:
- Use short paragraphs and bullet points.
- Use bold (**text**) for key terms.
- End with a "💡 Key takeaway:", "🧠 Try to recall:", or "📌 Related topic:" prompt.
- If the answer is completely missing from the context, reply: "I couldn't find enough detail about that in your notes."
- If the user asks to be tested, evaluated, or wants a quiz, DO NOT write questions in your response. Instead, reply EXACTLY with this code: [TRIGGER_QUIZ: X] (where X is the number of questions they want, or 10 if not specified).`
          },
          { role: 'user', content: finalPrompt }
        ]
      })
      text = completion.choices[0].message.content
    } catch (aiError) {
      console.error('OpenRouter Error:', aiError)
      text = "Aguila had a hiccup. Please try again!"
    }

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

// ✅ FIXED — correct table name + returns documents info
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

// ✅ FIXED — soft delete, not hard delete
export async function archiveSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ is_archived: true })
    .eq('id', sessionId)
  return { success: !error, error: error?.message }
}

// ✅ NEW — fetch archived sessions separately
export async function getArchivedSessions(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`*, session_documents(document_id, documents(file_name))`)
    .eq('user_id', userId)
    .eq('is_archived', true)
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, sessions: data }
}

// ✅ NEW — restore an archived session
export async function restoreSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ is_archived: false })
    .eq('id', sessionId)
  return { success: !error, error: error?.message }
}

// ✅ NEW — load past messages for a session
export async function getSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, messages: data }
}