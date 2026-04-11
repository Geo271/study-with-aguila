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
export async function generateLoungeQuiz({
  userId,
  documentId,     // optional — if a PDF was uploaded to the lounge
  contextText,    // optional — free-text context from chat history or user prompt
  requestedCount, // number | 'auto'
  topic,          // the topic/prompt from the user
}) {
  try {
    let fullContext = contextText || ''

    // If a documentId was provided, pull chunks from the DB
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

    // Auto-size: estimate question count based on content length
    const hasDocument = fullContext.trim().length > 200
    let numQuestions = requestedCount
    if (requestedCount === 'auto') {
      if (hasDocument) {
        // ~1 question per 300 words of content, capped at 100
        const wordCount = fullContext.split(/\s+/).length
        numQuestions = Math.min(100, Math.max(10, Math.floor(wordCount / 300)))
      } else {
        numQuestions = 15 // no document: generate based on topic knowledge
      }
    }

    // We generate in batches of 20 to stay within token limits
    const BATCH_SIZE = 20
    const batches = Math.ceil(numQuestions / BATCH_SIZE)
    const allQuestions = []

    for (let batch = 0; batch < batches; batch++) {
      const batchCount = Math.min(BATCH_SIZE, numQuestions - allQuestions.length)
      const startNum = allQuestions.length + 1

      const systemPrompt = `You are Aguila, an expert quiz generator. Generate exactly ${batchCount} quiz questions (questions ${startNum}–${startNum + batchCount - 1} of ${numQuestions}).

OUTPUT FORMAT — return a valid JSON array ONLY, no other text:
[
  {
    "type": "multiple_choice",
    "question": "Question text here?",
    "choices": { "A": "option", "B": "option", "C": "option", "D": "option" },
    "answer": "A",
    "explanation": "Why this is correct."
  },
  {
    "type": "identification",
    "question": "What term describes...?",
    "answer": "The exact answer",
    "explanation": "Brief explanation."
  }
]

RULES:
- Mix types: roughly 70% multiple_choice, 30% identification
- Questions must be specific, testable, and accurate
- Do NOT repeat questions already in this batch
- If using outside knowledge, note the source in the explanation (Author/Year or site name — NO Wikipedia ever)
- Cover different subtopics evenly; do not cluster on one area
- Vary difficulty: mix easy recall, medium application, hard analysis
- For multiple_choice: all 4 distractors must be plausible, not obviously wrong`

      const userContent = hasDocument
        ? `DOCUMENT CONTENT:\n"""\n${fullContext.slice(0, 14000)}\n"""\n\nGENERATE ${batchCount} questions that cover the content above. Topic focus: ${topic || 'all topics in the document'}.`
        : `TOPIC: ${topic}\n\nNo document provided. Generate ${batchCount} comprehensive questions based on your academic knowledge of this topic. Each explanation must cite a reliable source (textbook, journal, government site, university site — never Wikipedia).`

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
      } catch (err) {
        console.error(`Batch ${batch} AI error:`, err)
        continue
      }

      // Parse JSON — strip markdown fences if present
      try {
        const clean = rawText.replace(/```json|```/g, '').trim()
        const jsonStart = clean.indexOf('[')
        const jsonEnd = clean.lastIndexOf(']')
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON array found')
        const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1))
        allQuestions.push(...parsed)
      } catch (parseErr) {
        console.error(`Batch ${batch} parse error:`, parseErr, '\nRaw:', rawText.slice(0, 300))
        // Try to continue with next batch rather than failing entirely
      }
    }

    if (!allQuestions.length) {
      return { success: false, error: 'Could not generate any questions. Please try again.' }
    }

    // Save quiz + questions to DB so participants can take it
    const { data: quizRow, error: quizErr } = await supabase
      .from('quizzes')
      .insert([{
        user_id: userId,
        document_id: documentId || null,
        title: topic ? `Lounge Quiz: ${topic.slice(0, 60)}` : `Lounge Quiz (${allQuestions.length} questions)`,
        num_questions: allQuestions.length,
      }])
      .select()
      .single()

    if (quizErr) return { success: false, error: quizErr.message }

    const questionRows = allQuestions.map((q, i) => ({
      quiz_id: quizRow.id,
      question: q.question,
      type: q.type || 'multiple_choice',
      choices: q.choices || null,
      answer: q.answer,
      explanation: q.explanation || '',
      order_index: i,
    }))

    const { error: qErr } = await supabase.from('questions').insert(questionRows)
    if (qErr) return { success: false, error: qErr.message }

    return {
      success: true,
      quizId: quizRow.id,
      questions: allQuestions,
      count: allQuestions.length,
    }
  } catch (err) {
    console.error('generateLoungeQuiz error:', err)
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
        .limit(20)
      if (chunks?.length) knowledgeBase = chunks.map(c => c.content).join('\n\n')
    }

    const hasNotes = knowledgeBase.trim().length > 100

    const systemPrompt = `You are Aguila, an elite AI academic tutor in a collaborative study lounge.

CAPABILITIES:
1. Answer questions from uploaded notes with precision
2. Answer general academic questions using your knowledge
3. Generate study content and explanations
4. Help with grammar, writing, assignments
5. Create study plans

CITATION RULES — STRICTLY ENFORCED:
- When using outside knowledge, you MUST cite reliable sources: academic journals, textbooks, university websites, government sites (.gov, .edu), established news/research outlets
- NEVER cite Wikipedia or any wiki site — it is NOT an acceptable source
- Format citations as: (Author, Year) or [Source: site-name.com/path] — use real URLs when you know them
- Only cite sources published within the last 5 years for rapidly evolving topics
- If unsure of a source, say "according to established academic consensus in [field]" — never fabricate URLs

QUIZ TRIGGER RULE:
- If the user asks to generate/create/make a quiz, reply ONLY with: [QUIZ_REQUEST:N] where N is the number of questions they asked for (use 10 if unspecified, "auto" if they say "all topics" or "full coverage")
- Examples: "generate 50 questions" → [QUIZ_REQUEST:50], "quiz covering everything" → [QUIZ_REQUEST:auto], "make a quiz" → [QUIZ_REQUEST:10]

FORMAT:
- No emojis
- Use **bold** for key terms
- Keep paragraphs under 3 sentences
- End with: "Key takeaway: [one sentence]" OR "Recall prompt: [question]"
${hasNotes ? `\nCURRENT NOTES:\n"""\n${knowledgeBase.slice(0, 8000)}\n"""` : ''}`

    const completion = await openai.chat.completions.create({
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        // Include last 6 messages as history for context
        ...chatHistory.slice(-6).map(m => ({ role: m.userId === 'aguila-bot' ? 'assistant' : 'user', content: m.text })),
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