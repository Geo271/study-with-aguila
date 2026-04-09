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

    // General mode — no session (vacation/general help)
    let contextText = ''
    let docIds = []

    if (sessionId) {
      const { data: sessionDocs } = await supabase
        .from('session_documents')
        .select('document_id')
        .eq('session_id', sessionId)
      docIds = sessionDocs?.map(d => d.document_id) || []

      const isBroad = /quiz|question|summarize|summary|notes|explain|overview/i.test(question)
      if (isBroad) {
        const { data: chunks } = await supabase
          .from('document_chunks').select('content')
          .in('document_id', docIds).order('chunk_index', { ascending: true })
        contextText = chunks?.map(c => c.content).join('\n\n') || ''
      } else {
        const embRes = await embeddingModel.embedContent({
          content: { role: 'user', parts: [{ text: question }] },
          outputDimensionality: 768,
        })
        let { data: chunks } = await supabase.rpc('match_document_chunks', {
          query_embedding: embRes.embedding.values,
          match_threshold: 0.2, match_count: 50,
        })
        if (chunks?.length) chunks = chunks.filter(c => docIds.includes(c.document_id)).slice(0, 10)
        if (!chunks?.length) {
          const { data: fb } = await supabase.from('document_chunks').select('content')
            .in('document_id', docIds).order('chunk_index', { ascending: true }).limit(10)
          chunks = fb || []
        }
        contextText = chunks.map(c => c.content).join('\n\n')
      }
    }

    const hasNotes = contextText.trim().length > 0
    const systemPrompt = sessionId && hasNotes
      ? `You are Aguila, a professional AI academic tutor and study assistant.

PRIMARY CAPABILITIES:
1. STUDY TUTOR — Answer based on the student's uploaded notes. Cite sections when possible.
2. GRAMMAR AND WRITING COACH — When asked to improve grammar/writing, do so thoroughly with explanations.
3. ASSIGNMENT HELPER — Help understand requirements, brainstorm, outline. Guide — do not write it for them.
4. RESEARCH COMPANION — Summarize, explain, suggest sources. Cite references when using outside knowledge.
5. STUDY PLANNER — When asked, output a structured day-by-day study plan.
6. LANGUAGE SUPPORT — Help rephrase, simplify, or formalize writing.

STRICT RULES:
- Never use emojis anywhere in your response.
- Format with clean markdown: **bold** for key terms, numbered lists for steps, bullets for comparisons.
- 🌟 MERMAID RULE: When the user asks for a chart, graph, flowchart, diagram, or visual representation, YOU MUST output valid Mermaid.js syntax enclosed in a \`\`\`mermaid code block. NEVER use ASCII art or text-based shapes (+, -, |, v) for diagrams.
- Keep paragraphs to 2-3 sentences maximum.
- End every study response with one of: "Key takeaway: [one sentence]" OR "Recall prompt: [question to test retention]" OR "Suggested next step: [actionable advice]"
- Never fabricate citations.

QUIZ TRIGGER RULE — CRITICAL:
- If the user asks to CREATE, GENERATE, or START a quiz, you MUST reply with ONLY this exact string and nothing else: [TRIGGER_QUIZ:5]
- Replace 5 with the exact number they requested if they specified one (e.g. "10 questions" → [TRIGGER_QUIZ:10])
- Do NOT add any other text before or after the trigger string.

CONTEXT FROM NOTES:
"""
${contextText}
"""

STUDENT REQUEST: "${question}"`
      : `You are Aguila, a professional AI academic tutor and general study assistant.

The student does not have notes uploaded right now. Help them with:
- General study questions on any subject
- Grammar and writing improvement
- Essay and assignment brainstorming
- Study planning and scheduling
- Explaining academic concepts clearly
- Motivation and study habit advice

STRICT RULES:
- Never use emojis anywhere in your response.
- Format with clean markdown: **bold** for key terms, bullets for lists.
- 🌟 MERMAID RULE: When the user asks for a chart, graph, flowchart, diagram, or visual representation, YOU MUST output valid Mermaid.js syntax enclosed in a \`\`\`mermaid code block. NEVER use ASCII art or text-based shapes (+, -, |, v) for diagrams.
- Keep responses concise and student-friendly.
- End with one of: "Key takeaway: [one sentence]" OR "Suggested next step: [actionable advice]"

STUDENT REQUEST: "${question}"`

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

    // ── TRIGGER DETECTION (server-side, before saving to DB) ──────────
    const triggerMatch = rawText.match(/\[TRIGGER_QUIZ:(\d+)\]/)
    if (triggerMatch) {
      const quizCount = parseInt(triggerMatch[1])
      const displayText = `Generating a ${quizCount}-question quiz from your notes...`
      if (sessionId) {
        await supabase.from('chat_messages').insert([
          { session_id: sessionId, user_id: userId, role: 'user', content: question },
          { session_id: sessionId, user_id: userId, role: 'ai', content: displayText },
        ])
      }
      return { success: true, answer: displayText, quizTrigger: quizCount }
    }

    // ── Normal message — save to DB ───────────────────────────────────
    if (sessionId) {
      await supabase.from('chat_messages').insert([
        { session_id: sessionId, user_id: userId, role: 'user', content: question },
        { session_id: sessionId, user_id: userId, role: 'ai', content: rawText },
      ])
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