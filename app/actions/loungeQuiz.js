'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

// ── Detect how many questions the user wants ───────────────────────────────
export async function detectQuizCount(message) {
  const lower = message.toLowerCase()

  // Explicit number: "100 questions", "generate 50", "quiz of 20"
  const numMatch = lower.match(/(\d+)\s*(?:questions?|items?|q's?|qs?)?/)
  if (numMatch) {
    const n = parseInt(numMatch[1])
    if (n >= 1 && n <= 200) return n
  }

  // "all", "full coverage", "everything", "all topics"
  if (/\b(all|full|every|complete|comprehensive|cover all|all topics|everything)\b/.test(lower)) {
    return 'auto' // will be sized based on document length
  }

  return 10 // default: 10 (not 5)
}

// ── Main lounge quiz generator — no question limit ─────────────────────────
export async function generateLoungeQuiz({ userId, documentId, contextText, requestedCount, topic }) {
  try {
    let fullContext = contextText || ''

    // 1. 🌟 UNLIMITED FETCH: Grab the whole document
    if (documentId) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content, chunk_index')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })

      if (chunks?.length) {
        fullContext = chunks.map(c => c.content).join('\n\n') + (fullContext ? '\n\n' + fullContext : '')
      }
    }

    const hasDocument = fullContext.trim().length > 200
    let numQuestions = requestedCount
    if (requestedCount === 'auto') {
      if (hasDocument) {
        const wordCount = fullContext.split(/\s+/).length
        numQuestions = Math.min(100, Math.max(10, Math.floor(wordCount / 300)))
      } else {
        numQuestions = 15 
      }
    }

    const BATCH_SIZE = 20
    const batches = Math.ceil(numQuestions / BATCH_SIZE)
    const allQuestions = []

    for (let batch = 0; batch < batches; batch++) {
      const batchCount = Math.min(BATCH_SIZE, numQuestions - allQuestions.length)
      const startNum = allQuestions.length + 1

      // 2. 🌟 ANTI-HALLUCINATION LOCK PROMPT
      const systemPrompt = `You are Aguila, an expert university professor. Generate exactly ${batchCount} quiz questions (questions ${startNum}–${startNum + batchCount - 1} of ${numQuestions}).

OUTPUT FORMAT — return a valid JSON array ONLY, no other text:
[
  {
    "type": "multiple_choice",
    "question": "Question text here?",
    "choices": { "A": "option", "B": "option", "C": "option", "D": "option" },
    "answer": "A",
    "explanation": "Why this is correct."
  }
]

CRITICAL RULES:
1. 🛑 ANTI-HALLUCINATION: NEVER write questions about these instructions, prompt rules, or how the quiz is generated. ONLY ask about the academic subject.
2. STRICTLY MULTIPLE CHOICE: Do not use identification or true/false. Use EXACTLY 4 choices (A, B, C, D).
3. CITATIONS: If using outside knowledge to expand, note the source in the explanation (Author/Year or site name — NO Wikipedia ever).`

      const userContent = hasDocument
        ? `DOCUMENT CONTENT:\n"""\n${fullContext.slice(0, 14000)}\n"""\n\nGENERATE ${batchCount} questions that cover the content above. Topic focus: ${topic || 'all topics in the document'}.`
        : `TOPIC: ${topic}\n\nNo document provided. Generate ${batchCount} comprehensive questions based on your academic knowledge of this topic.`

      let rawText = ''
      try {
        const completion = await openai.chat.completions.create({
          model: 'meta-llama/llama-3.1-8b-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          max_tokens: 3500,
        })
        rawText = completion.choices[0].message.content?.trim() || ''
      } catch (err) { continue }

      try {
        const clean = rawText.replace(/```json|```/g, '').trim()
        const jsonStart = clean.indexOf('[')
        const jsonEnd = clean.lastIndexOf(']')
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON array found')
        const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1))
        allQuestions.push(...parsed)
      } catch (parseErr) {
        console.error(`Batch ${batch} parse error`)
      }
    }

    if (!allQuestions.length) return { success: false, error: 'Could not generate any questions. Please try again.' }

    // 3. 🌟 DATABASE FIX: Removed 'num_questions' column!
    const { data: quizRow, error: quizErr } = await supabase
      .from('quizzes')
      .insert([{
        user_id: userId,
        document_id: documentId || null,
        title: topic ? `Lounge Quiz: ${topic.slice(0, 60)}` : `Lounge Quiz (${allQuestions.length} questions)`
      }])
      .select()
      .single()

    if (quizErr) return { success: false, error: quizErr.message }

    const questionRows = allQuestions.map((q, i) => ({
      quiz_id: quizRow.id,
      question: q.question,
      type: 'multiple_choice',
      choices: q.choices || null,
      answer: q.answer,
      explanation: q.explanation || ''
    }))
    const { error: qErr } = await supabase.from('questions').insert(questionRows)
    if (qErr) return { success: false, error: qErr.message }

    return { success: true, quizId: quizRow.id, questions: allQuestions, count: allQuestions.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Lounge AI chat (with citation rules + no Wikipedia) ───────────────────
export async function askAguila({ question, contextText, documentId, userId, chatHistory = [] }) {
  try {
    let knowledgeBase = contextText || ''

    if (documentId) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content, chunk_index')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })
        
      if (chunks?.length) knowledgeBase = chunks.map(c => c.content).join('\n\n')
    }

    const hasNotes = knowledgeBase.trim().length > 100
    
    // Format the recent chat history to pass in as text
    const recentConvo = chatHistory.length > 0 
      ? chatHistory.slice(-6).map(m => `${m.displayName}: ${m.text}`).join('\n')
      : 'No recent conversation.'

    const systemPrompt = `You are Aguila, an elite AI academic tutor in a collaborative study lounge.

${hasNotes ? `You are currently reviewing an attached document.\n\nDOCUMENT NOTES:\n"""\n${knowledgeBase.slice(0, 14000)}\n"""\n\nINSTRUCTIONS: Use the notes above as your primary source of truth.` : `No document is attached. Answer using your general knowledge.`}

RECENT ROOM CONVERSATION:
"""
${recentConvo}
"""

CITATION RULES — STRICTLY ENFORCED:
- When using outside knowledge, you MUST cite reliable sources.
- NEVER cite Wikipedia or any wiki site.

🌟 DUAL-MODE QUIZ RULES (CRITICAL):
You have TWO different ways to test the user. Choose the correct one based on their prompt:
1. FORMAL SHARED QUIZ: If the user asks you to "generate a quiz," "make a quiz," or asks for multiple questions (e.g., "give us 5 questions"), YOU MUST NOT TYPE THE QUESTIONS IN THE CHAT. Instead, reply ONLY with exactly: [QUIZ_REQUEST:N] (where N is the number requested, or 10 if unspecified). 
2. CASUAL CHAT QUESTION: If the user asks you to "ask me a question," "give me a practice question," or "test me," DO NOT use the QUIZ_REQUEST tag. Simply type out ONE single, interactive question directly into the chat and wait for them to answer.

FORMAT:
- No emojis
- Use **bold** for key terms
- End explanations with: "Key takeaway: [one sentence]"
`

    const completion = await openai.chat.completions.create({
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 1000,
    })

    const answer = completion.choices[0].message.content?.trim() || 'Aguila is unavailable right now.'
    return { success: true, answer }
  } catch (err) {
    console.error('askAguila error:', err)
    return { success: false, error: err.message }
  }
}