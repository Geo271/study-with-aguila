'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

export async function askDocument(question, sessionIdOrDocId, userId) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

    let contextText = ''
    let docIds = []
    let fileName = '' // 🌟 NEW: Track the name of the file

    if (sessionIdOrDocId) {
      // 1. Check if this is a Session ID
      const { data: sessionDocs } = await supabase
        .from('session_documents')
        .select('document_id')
        .eq('session_id', sessionIdOrDocId)
      
      docIds = sessionDocs?.map(d => d.document_id) || []

      // 2. Lounge Mode: If no session docs, assume it's a direct Document ID
      if (docIds.length === 0) {
        docIds = [sessionIdOrDocId]
      }

      // 🌟 NEW: Fetch the actual filename so Aguila knows what the file is called!
      if (docIds.length > 0) {
        const { data: docInfo } = await supabase
          .from('documents')
          .select('file_name')
          .in('id', docIds)
          .limit(1)
        
        if (docInfo && docInfo[0]) fileName = docInfo[0].file_name
      }

      const isBroad = /quiz|question|summarize|summary|notes|explain|overview/i.test(question)
      
      if (isBroad) {
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content')
          .in('document_id', docIds)
          .order('chunk_index', { ascending: true })
        
        contextText = chunks?.map(c => c.content).join('\n\n') || ''
      } else {
        const embRes = await embeddingModel.embedContent({
          content: { role: 'user', parts: [{ text: question }] },
          outputDimensionality: 768,
        })
        
        let { data: chunks } = await supabase.rpc('match_document_chunks', {
          query_embedding: embRes.embedding.values,
          match_threshold: 0.2, 
          match_count: 50,
        })
        
        if (chunks?.length) {
          chunks = chunks.filter(c => docIds.includes(c.document_id)).slice(0, 15)
        }
        
        if (!chunks?.length) {
          const { data: fb } = await supabase.from('document_chunks').select('content')
            .in('document_id', docIds).order('chunk_index', { ascending: true }).limit(15)
          chunks = fb || []
        }
        contextText = chunks.map(c => c.content).join('\n\n')
      }
    }

    const hasNotes = contextText.trim().length > 0
    
    // 3. 🌟 PERSONA UPDATE: Tell Aguila exactly what file she is reading
    const systemPrompt = `
      You are Aguila, a professional AI academic tutor.
      
      ${hasNotes ? `You are currently reviewing a document called: "${fileName || 'Uploaded Notes'}"
      
      CONTEXT FROM THIS DOCUMENT:
      """
      ${contextText}
      """
      
      INSTRUCTIONS:
      1. Use the notes above as your primary source of truth.
      2. If the user refers to the "file" or "document," they are talking about "${fileName}".
      3. Use Markdown (**bold**) for key academic terms.` 
      
      : `CRITICAL SAFETY RULE: The user has NOT successfully provided a PDF or notes yet. IF the user asks you to summarize a document, explain a document, or generate a quiz, YOU MUST politely tell them: "I haven't finished memorizing the document yet! Please wait for the ✅ success message in the chat." DO NOT hallucinate or guess the contents of the document.`}

      STRICT RULES:
      - Never use emojis.
      - 🌟 MERMAID RULE: For diagrams/flowcharts, use only \`\`\`mermaid syntax.
      - End with a "Key takeaway" or "Recall prompt".
    `

    let rawText = ''
    try {
      const completion = await openai.chat.completions.create({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      })
      rawText = completion.choices[0].message.content?.trim() || ''
    } catch (aiError) {
      console.error('OpenRouter Error:', aiError)
      rawText = 'Aguila had a hiccup. Please try again.'
    }

    // Handle Quiz Triggers
    const triggerMatch = rawText.match(/\[TRIGGER_QUIZ:(\d+)\]/)
    if (triggerMatch) {
      const quizCount = parseInt(triggerMatch[1])
      return { success: true, answer: `Generating a ${quizCount}-question quiz for the room...`, quizTrigger: quizCount }
    }

    // 🌟 Corrected DB Check: Ensure we don't crash when using UUIDs in the Lounge
    // Only save to chat_messages if it's a 36-character UUID representing a study session
    if (sessionIdOrDocId && sessionIdOrDocId.length === 36) {
        // Verify it's a session ID, not a document ID, before saving
        const { data: isSession } = await supabase.from('study_sessions').select('id').eq('id', sessionIdOrDocId).maybeSingle()
        if (isSession) {
            await supabase.from('chat_messages').insert([
                { session_id: sessionIdOrDocId, user_id: userId, role: 'user', content: question },
                { session_id: sessionIdOrDocId, user_id: userId, role: 'ai', content: rawText },
            ])
        }
    }

    return { success: true, answer: rawText }
  } catch (error) {
    console.error('Chat Error:', error)
    return { success: false, error: error.message }
  }
}

export async function getSessions(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`*, session_documents(document_id, documents(file_name))`)
    .eq('user_id', userId).eq('is_archived', false)
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, sessions: data }
}

export async function archiveSession(sessionId) {
  const { error } = await supabase.from('study_sessions').update({ is_archived: true }).eq('id', sessionId)
  return { success: !error }
}

export async function getArchivedSessions(userId) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`*, session_documents(document_id, documents(file_name))`)
    .eq('user_id', userId).eq('is_archived', true)
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, sessions: data }
}

export async function restoreSession(sessionId) {
  const { error } = await supabase.from('study_sessions').update({ is_archived: false }).eq('id', sessionId)
  return { success: !error }
}

export async function getSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from('chat_messages').select('role, content, created_at')
    .eq('session_id', sessionId).order('created_at', { ascending: true })
  if (error) return { success: false, error: error.message }
  return { success: true, messages: data }
}