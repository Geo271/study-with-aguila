'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export async function generateQuiz(documentId, userId, numQuestions = 'auto', sessionId = null, chatContext = null, chatHistory = null) {
  try {
    let contextText = ''

    // 1. Fetch PDF notes with token bounding (top 15 chunks max)
    if (documentId) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })
        .limit(15)
      contextText = chunks?.map(c => c.content).join('\n\n') || ''
    }

    const sourceMaterial = `
      ${contextText ? `DOCUMENT NOTES:\n${contextText.slice(0, 10000)}\n\n` : ''}
      ${chatHistory ? `RECENT ROOM CONVERSATION (Reviewer Info):\n${chatHistory.slice(0, 3000)}` : ''}
    `.trim()

    const topicMatch = chatContext?.match(/(?:about|on|covering|for)\s+(.*)/i)
    const fallbackTopic = topicMatch ? topicMatch[1] : "General Academic Review"

    const targetCount = numQuestions === 'auto' ? 10 : Math.min(25, Math.max(3, parseInt(numQuestions) || 5))

    const prompt = `
You are an expert university examiner creating an exam practice quiz.

QUESTION COUNT TARGET:
Generate exactly ${targetCount} high-yield multiple choice questions.

PRIMARY SOURCE MATERIAL:
${sourceMaterial ? `"""\n${sourceMaterial}\n"""` : `"""\nNo document attached. Create a quiz about: ${fallbackTopic}\n"""`}

ACADEMIC RIGOR RULES:
1. Support any university subject: STEM formulas, medical/biological mechanisms, legal doctrines, accounting rules, or historical analysis.
2. Filter out casual chat or informal banter. Focus solely on core testable concepts, definitions, and problem-solving.
3. Every question must have exactly 4 choices (A, B, C, D) with 1 clearly correct answer and 3 plausible distractors.
4. Provide a clear, educational explanation for why the correct option is right.

STRICT JSON FORMAT:
Return ONLY a valid JSON array matching this exact schema. No markdown formatting outside the JSON, no backticks, no preamble.
[
  {
    "type": "multiple_choice",
    "question": "Question text here?",
    "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "answer": "Choice A",
    "explanation": "Detailed explanation of why Choice A is correct."
  }
]
`

    let text = ''

    // 1. Primary Attempt: OpenRouter (DeepSeek V3 / LLaMA 3.3 70B)
    const openRouterModel = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat'
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const completion = await openai.chat.completions.create({
          model: openRouterModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 3500,
        })
        text = completion.choices[0]?.message?.content || ''
      } catch (openRouterErr) {
        console.warn('OpenRouter quiz generation warning, falling back to Gemini:', openRouterErr.message)
      }
    }

    // 2. High-Availability Fallback: Google Gemini 2.0 Flash
    if (!text && process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash',
          generationConfig: { responseMimeType: 'application/json' }
        })
        const result = await model.generateContent(prompt)
        text = result.response.text() || ''
      } catch (geminiErr) {
        console.error('Gemini quiz generation error:', geminiErr)
      }
    }

    // Extract JSON safely
    const startIndex = text.indexOf('[')
    const endIndex = text.lastIndexOf(']')
    
    if (startIndex === -1 || endIndex === -1) {
      console.error("Raw AI Quiz Response:", text)
      return { success: false, error: "The AI was unable to structure the quiz questions. Please try again with a specific topic." }
    }

    const cleanJsonString = text.substring(startIndex, endIndex + 1)
    let questions
    try {
      questions = JSON.parse(cleanJsonString)
    } catch (parseError) {
      console.error("Failed to parse AI quiz JSON:", parseError)
      return { 
        success: false, 
        error: "Formatting error during quiz generation. Please try requesting 5 to 10 questions." 
      }
    }

    const { data: quiz, error: quizDbError } = await supabase
      .from('quizzes')
      .insert([{ 
        document_id: documentId, 
        user_id: userId, 
        title: `${targetCount}-Question Mastery Review`, 
        session_id: sessionId 
      }])
      .select()
      .single()

    if (quizDbError) throw new Error(`Quiz DB Error: ${quizDbError.message}`)

    const questionRecords = questions.map(q => ({
      quiz_id: quiz.id,
      question: q.question,
      choices: q.choices, 
      answer: q.answer,
      explanation: q.explanation,
      type: q.type || 'multiple_choice'
    }))

    await supabase.from('questions').insert(questionRecords)

    return { success: true, quizId: quiz.id, questions }
  } catch (error) {
    console.error('Quiz generation error:', error)
    return { success: false, error: error.message }
  }
}

// Save quiz result when user finishes
export async function saveQuizResult(quizId, userId, score, total, quizTitle) {
  const { error } = await supabase
    .from('quiz_results')
    .insert([{
      quiz_id: quizId,
      user_id: userId,
      score,
      total,
      quiz_title: quizTitle || `${total}-Question Quiz`,
      completed_at: new Date().toISOString(),
    }])
  return { success: !error, error: error?.message }
}

// Save individual wrong answers so the AI can use them for targeted review
export async function saveWrongAnswers(quizId, userId, wrongAnswers) {
  if (!wrongAnswers.length) return { success: true }
  const records = wrongAnswers.map(a => ({
    quiz_id: quizId,
    user_id: userId,
    question: a.question,
    user_answer: a.selected || '',
    correct_answer: a.correct,
  }))
  const { error } = await supabase.from('quiz_wrong_answers').insert(records)
  return { success: !error }
}

// Fetch all quizzes (for archive + progress)
export async function getUserQuizzes(userId) {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`*, questions(id, type, question, choices, answer, explanation), documents(file_name)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, quizzes: data }
}

export async function deleteUserQuiz(quizId) {
  const { error } = await supabase.from('quizzes').delete().eq('id', quizId)
  return { success: !error }
}
