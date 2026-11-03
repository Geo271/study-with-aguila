'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

/**
 * Intelligent topic title generator: extracts a concise 3-5 word academic title
 * using Gemini 2.0 Flash (with OpenRouter fallback)
 */
export async function generateTopicTitle(sampleText) {
  if (!sampleText || sampleText.trim().length === 0) return 'Study Session'

  const prompt = `You are a professional academic topic title generator for a study application.
Generate a concise 3 to 5 word professional topic title based on the following user query or study notes.
DO NOT wrap in quotes. DO NOT add punctuation or prefixes like "Title:".
Output ONLY the clean 3 to 5 word title.

Excerpt:
"""
${sampleText.slice(0, 1200)}
"""`

  // 1. Try Gemini 2.0 Flash first (fast, generous token budget)
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const res = await model.generateContent(prompt)
      const title = res.response.text()?.replace(/["'\n\r#*]/g, '').trim()
      if (title && title.length >= 3 && title.length <= 48) {
        return title
      }
    } catch (e) {
      console.warn('Gemini title generation warning:', e.message)
    }
  }

  // 2. OpenRouter fallback
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 25,
        temperature: 0.3,
      })
      const title = completion.choices[0]?.message?.content?.replace(/["'\n\r#*]/g, '').trim()
      if (title && title.length >= 3 && title.length <= 48) {
        return title
      }
    } catch (e) {
      console.warn('OpenRouter title generation warning:', e.message)
    }
  }

  // Clean fallback if both fail
  const cleaned = sampleText
    .slice(0, 32)
    .replace(/\.[^/.]+$/, '')
    .replace(/[_\-\[\]()%20]+/g, ' ')
    .trim()
  return cleaned || 'Study Session'
}

/**
 * Update session title directly
 */
export async function updateSessionTitle(sessionId, newTitle) {
  if (!sessionId || !newTitle) return { success: false }
  const { error } = await supabase
    .from('study_sessions')
    .update({ title: newTitle.trim() })
    .eq('id', sessionId)
  return { success: !error }
}

export async function askDocument(question, sessionIdOrDocId, userId, modelChoice = null) {
  try {
    let contextText = ''
    let docIds = []
    let fileName = ''

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

      // Fetch the actual filename
      if (docIds.length > 0) {
        const { data: docInfo } = await supabase
          .from('documents')
          .select('file_name')
          .in('id', docIds)
          .limit(1)
        
        if (docInfo && docInfo[0]) fileName = docInfo[0].file_name
      }

      const isBroad = /quiz|question|summarize|summary|notes|explain|overview|all/i.test(question)
      
      if (isBroad) {
        // Broad query: fetch first 10 chunks ordered by index to bound token usage
        const { data: chunks } = await supabase
          .from('document_chunks')
          .select('content')
          .in('document_id', docIds)
          .order('chunk_index', { ascending: true })
          .limit(10)
        
        contextText = chunks?.map(c => c.content).join('\n\n') || ''
      } else {
        // Semantic search using Gemini embedding model
        let embeddingValues = null
        if (process.env.GEMINI_API_KEY) {
          try {
            const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
            const embRes = await embeddingModel.embedContent({
              content: { role: 'user', parts: [{ text: question }] },
              outputDimensionality: 768,
            })
            embeddingValues = embRes.embedding?.values
          } catch (embErr) {
            console.warn('Embedding generation warning:', embErr.message)
          }
        }

        if (embeddingValues) {
          let { data: chunks } = await supabase.rpc('match_document_chunks', {
            query_embedding: embeddingValues,
            match_threshold: 0.2, 
            match_count: 30,
          })
          
          if (chunks?.length) {
            chunks = chunks.filter(c => docIds.includes(c.document_id)).slice(0, 8)
          }
          
          if (!chunks?.length) {
            const { data: fb } = await supabase.from('document_chunks').select('content')
              .in('document_id', docIds).order('chunk_index', { ascending: true }).limit(8)
            chunks = fb || []
          }
          contextText = chunks.map(c => c.content).join('\n\n')
        } else {
          // Fallback to sequential chunks if embedding is unavailable
          const { data: fb } = await supabase.from('document_chunks').select('content')
            .in('document_id', docIds).order('chunk_index', { ascending: true }).limit(8)
          contextText = (fb || []).map(c => c.content).join('\n\n')
        }
      }
    }

    const hasNotes = contextText.trim().length > 0
    
    // Multi-turn conversational context: retrieve recent messages for context continuity
    let pastMessages = []
    if (sessionIdOrDocId && sessionIdOrDocId.length === 36) {
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionIdOrDocId)
        .order('created_at', { ascending: false })
        .limit(8)
      
      if (history?.length) {
        pastMessages = history.reverse().map(h => ({
          role: h.role === 'ai' ? 'assistant' : 'user',
          content: h.content,
        }))
      }
    }

    const systemPrompt = `
You are Aguila, a friendly, encouraging, and academically rigorous study companion with a retro scholar spirit.

${hasNotes ? `You are currently referencing the student's study material: "${fileName || 'Uploaded Notes'}"

RELEVANT EXCERPTS FROM NOTES:
"""
${contextText.slice(0, 7000)}
"""

TUTORING INSTRUCTIONS:
1. Ground your explanation in the student's material above.
2. If the user refers to "this", "the file", or "the notes", reference "${fileName}".
3. Bold key academic terminology for rapid recall.
4. Provide step-by-step clarity for any university course: STEM (with formulas), Medicine (with pathophysiology), Law (with IRAC), or Business.
5. Keep explanations crisp, educational, and easy to memorize.` 
: `CRITICAL INSTRUCTION: The student has not uploaded course notes for this session yet. Answer general academic questions thoughtfully, or encourage them to upload lecture notes/PDFs so you can cite their specific curriculum.`}

RESPONSE GUIDELINES:
- Avoid emoji clutter. Maintain clean academic markdown formatting.
- For diagrams, mind maps, or process flows, use ONLY \`\`\`mermaid code blocks.
- End your response with a concise "💡 Key Takeaway" or an active recall question to verify comprehension.
`

    const selectedModel = modelChoice || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat'
    let modelUsed = selectedModel
    let rawText = ''

    // 1. Primary AI Call: OpenRouter (with specified or default model)
    if (process.env.OPENROUTER_API_KEY && selectedModel !== 'gemini-direct') {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...pastMessages,
          { role: 'user', content: question },
        ]

        const completion = await openai.chat.completions.create({
          model: selectedModel,
          messages,
          max_tokens: 1500,
          temperature: 0.5,
        })
        rawText = completion.choices[0]?.message?.content?.trim() || ''
      } catch (openRouterErr) {
        console.warn(`OpenRouter (${selectedModel}) warning, switching to Gemini:`, openRouterErr.message)
      }
    }

    // 2. High-Availability Fallback: Google Gemini 2.0 Flash (Fast, generous tokens)
    if (!rawText && process.env.GEMINI_API_KEY) {
      try {
        modelUsed = 'google/gemini-2.0-flash'
        const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const conversationPrompt = `${systemPrompt}\n\n` +
          pastMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') +
          `\n\nUSER: ${question}\nASSISTANT:`
        
        const result = await geminiModel.generateContent(conversationPrompt)
        rawText = result.response.text()?.trim() || ''
      } catch (geminiErr) {
        console.error('Gemini fallback chat error:', geminiErr)
      }
    }

    if (!rawText) {
      rawText = "Aguila encountered a temporary network delay. Please re-send your question or check your API key configuration."
    }

    // Handle Quiz Triggers
    const triggerMatch = rawText.match(/\[TRIGGER_QUIZ:(\d+)\]/)
    if (triggerMatch) {
      const quizCount = parseInt(triggerMatch[1])
      return { success: true, answer: `Generating a ${quizCount}-question quiz for the room...`, quizTrigger: quizCount }
    }

    // Save conversation to chat_messages
    let updatedTitle = null
    if (sessionIdOrDocId && sessionIdOrDocId.length === 36) {
      const { data: isSession } = await supabase.from('study_sessions').select('id, title').eq('id', sessionIdOrDocId).maybeSingle()
      if (isSession) {
        await supabase.from('chat_messages').insert([
          { session_id: sessionIdOrDocId, user_id: userId, role: 'user', content: question },
          { session_id: sessionIdOrDocId, user_id: userId, role: 'ai', content: rawText },
        ])

        // Auto-rename session context if title is generic
        const currentTitle = isSession.title || ''
        const isGenericTitle = currentTitle === 'New Session' || 
          currentTitle.endsWith('...') || 
          currentTitle.toLowerCase().startsWith('hello') ||
          currentTitle.toLowerCase().startsWith('hi') ||
          currentTitle.includes('%20') ||
          currentTitle.length < 5

        if (isGenericTitle) {
          const sampleForTitle = fileName ? `${fileName}: ${question}` : question
          const newTitle = await generateTopicTitle(sampleForTitle)
          if (newTitle && newTitle !== currentTitle) {
            await supabase.from('study_sessions').update({ title: newTitle }).eq('id', sessionIdOrDocId)
            updatedTitle = newTitle
          }
        }
      }
    }

    const estimatedTokens = Math.ceil((contextText.length + question.length + rawText.length) / 4)

    return { 
      success: true, 
      answer: rawText, 
      updatedTitle,
      modelUsed,
      tokensUsed: estimatedTokens
    }
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
