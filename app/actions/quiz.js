'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import OpenAI from 'openai'

// Setup OpenRouter for the Quiz Generator
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
})

export async function generateQuiz(documentId, userId, numQuestions = 5, sessionId = null) {
  try {
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })

    const contextText = chunks.map(c => c.content).join('\n\n')

    const prompt = `
      You are an expert exam generator. The user has requested up to ${numQuestions} study questions based on the notes below.
      
      NOTES:
      ${contextText}
      
      CRITICAL QUALITY RULE:
      Analyze the depth of the notes. Do NOT repeat questions. If the notes only contain enough distinct facts for fewer than ${numQuestions} high-quality questions, STOP early.
      
      FORMAT RULES:
      - Return ONLY a valid JSON array. No markdown formatting, no backticks, no explanations outside the JSON.
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

    // Use Llama 3 via OpenRouter to generate the quiz JSON
    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct",
      messages: [
        { role: "user", content: prompt }
      ]
    });

 const text = completion.choices[0].message.content;

    // 🛡️ BULLETPROOF JSON EXTRACTOR
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
      console.error("Raw AI Response:", text);
      return { success: false, error: "The AI couldn't find enough information in the notes to make a quiz." };
    }

    const cleanJsonString = text.substring(startIndex, endIndex + 1);
    const questions = JSON.parse(cleanJsonString);

    const { data: quiz } = await supabase
      .from('quizzes')
      .insert([{ document_id: documentId, user_id: userId, title: `${numQuestions}-Question Review`, session_id: sessionId }])
      .select()
      .single()

    const questionRecords = questions.map(q => ({
      quiz_id: quiz.id,
      question: q.question,
      choices: q.choices, 
      answer: q.answer,
      explanation: q.explanation,
      type: q.type 
    }))

    await supabase.from('questions').insert(questionRecords)

    return { success: true, quizId: quiz.id, questions }
  } catch (error) {
    console.error('Quiz generation error:', error)
    return { success: false, error: error.message }
  }
}