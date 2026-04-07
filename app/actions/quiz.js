'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// 1. Keep the '= 5' safety net! It only activates if the frontend fails to send a number.
export async function generateQuiz(documentId, userId, numQuestions = 5, sessionId = null) {
  try {
    // 2. FIXED MODEL NAME: Using the stable 2026 model to prevent 404s
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // 3. Grab chunks dynamically based on quiz length
    const chunkLimit = numQuestions > 5 ? 20 : 10;

    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
      .limit(chunkLimit)

    const contextText = chunks.map(c => c.content).join('\n\n')

    // 4. Strict JSON prompt — matches your QuizMode.js expectations perfectly
    const prompt = `
      You are an expert exam generator. The user has requested up to ${numQuestions} study questions based on the notes below.
      
      NOTES:
      ${contextText}
      
      CRITICAL QUALITY RULE:
      Analyze the depth of the notes. Do NOT repeat questions. If the notes only contain enough distinct facts for fewer than ${numQuestions} high-quality questions, STOP early.
      
      FORMAT RULES:
      - Return ONLY a valid JSON array. No markdown, no backticks.
      - Create a mix of "multiple_choice" and "identification".
      - "multiple_choice": Provide EXACTLY 4 choices as a JSON object with keys "A", "B", "C", "D". The answer must be just the letter.
      - "identification": Provide a question that requires a 1-3 word answer. Leave "choices" as an empty object {}.
      
      EXACT FORMAT:
      [
        {
          "type": "multiple_choice",
          "question": "Which of the following is...?",
          "choices": { "A": "Choice 1", "B": "Choice 2", "C": "Choice 3", "D": "Choice 4" },
          "answer": "A",
          "explanation": "This is correct because..."
        },
        {
          "type": "identification",
          "question": "The financial metric that evaluates efficiency is called...",
          "choices": {},
          "answer": "Return on Investment",
          "explanation": "ROI measures..."
        }
      ]
    `

    const result = await textModel.generateContent(prompt)
    const text = result.response.text()

    // Strip any accidental markdown fences and parse
    const cleaned = text.replace(/```json|```/g, '').trim()
    const questions = JSON.parse(cleaned)

    // Save quiz session to database with dynamic title
    const { data: quiz } = await supabase
    .from('quizzes')
    .insert([{ document_id: documentId, user_id: userId, title: `${numQuestions}-Question Review`, session_id: sessionId }])
      .select()
      .single()

    // Save all questions to the database
    const questionRecords = questions.map(q => ({
      quiz_id: quiz.id,
      question: q.question,
      choices: q.choices, // Now properly maps to the object your UI needs!
      answer: q.answer,
      explanation: q.explanation,
      type: q.type // Ensure your Supabase 'questions' table has a 'type' column!
    }))

    await supabase.from('questions').insert(questionRecords)

    return { success: true, quizId: quiz.id, questions }
  } catch (error) {
    console.error('Quiz generation error:', error)
    return { success: false, error: error.message }
  }
}