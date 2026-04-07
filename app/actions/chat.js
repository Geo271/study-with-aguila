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
            content: `You are Aguila 🦅, an elite AI academic tutor and study coach. Your role is to help students deeply understand their course material.

CRITICAL RULE REGARDING QUIZZES: 
- If the user asks for advice or topics *about* a quiz, answer them normally in text.
- ONLY if the user explicitly asks you to GENERATE, START, or CREATE a quiz, you must NOT write questions in chat. Instead, reply EXACTLY with this secret code: [TRIGGER_QUIZ: X].
  * IMPORTANT: If the user requests a specific number of questions (e.g., "10 questions"), 'X' MUST be exactly that number. If they do NOT specify a number, you may independently decide 'X' based on the notes (max 15).
                                          
RESPONSE GUIDELINES:
- Use short paragraphs and bullet points.
- Use bold (**text**) for key terms.
- End with a "💡 Key takeaway:", "🧠 Try to recall:", or "📌 Related topic:" prompt.
- If the answer is completely missing from the context, reply: "I couldn't find enough detail about that in your notes."

CONTEXT FROM STUDENT'S NOTES:
"""
${contextText}
"""

STUDENT'S QUESTION: "${question}"

YOUR NEW DIRECTIVES:
1. 📖 NATIVE KNOWLEDGE FIRST: Answer primarily using the provided notes context.
2. 🌍 OUTSIDE KNOWLEDGE ALLOWED: If the notes are incomplete or the student needs a broader understanding, you MAY use your own academic knowledge to explain the concept.
3. 🔗 STRICT CITATION RULE: If you introduce outside knowledge, you MUST cite your source. 
   - Cite the Author, Title, and Year.
   - VALIDITY TIMEFRAME: You must only cite references published within the last 3 years (2024, 2025, or 2026). Do not make claims based on outdated sources.
4. 🧠 SUGGEST LEARNING METHODS: If the user is struggling to grasp a concept, proactively suggest a specific learning method (e.g., The Feynman Technique, Spaced Repetition, or Analogy mapping) and guide them through it.
5. STRUCTURE: Use short paragraphs (2-3 sentences), bullet points, and bold text (**text**) for readability. Do not output a cramped wall of text.
`
          },
          { role: 'user', content: finalPrompt }
        ]
      })
      text = completion.choices[0].message.content
    } catch (aiError) {
      console.error('OpenRouter Error:', aiError)
      text = "Aguila had a hiccup. Please try again!"
    }

    let dbText = text;
    const triggerMatch = text.match(/TRIGGER_QUIZ\D+(\d+)/i);
    if (triggerMatch) {
      dbText = `*Generated a ${triggerMatch[1]}-question quiz* 🎯`;
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