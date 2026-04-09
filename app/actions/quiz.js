'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import OpenAI from 'openai'

// Setup OpenRouter for the Quiz Generator
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
})

// 🌟 NEW: Added chatContext parameter
export async function generateQuiz(documentId, userId, numQuestions = 5, sessionId = null, chatContext = null) {
  try {
    let contextText = ''

    // 🌟 If we have a document, grab the notes from the database
    if (documentId) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })
      contextText = chunks?.map(c => c.content).join('\n\n') || ''
    } 
    // 🌟 If no document, use the provided chat conversation!
    else if (chatContext) {
      contextText = chatContext
    } 
    // Failsafe
    else {
      return { success: false, error: "No notes or conversation found to generate a quiz." }
    }

    const prompt = `
      You are an expert university professor creating an exam. The user requested EXACTLY ${numQuestions} study questions based on the notes below.
      
      NOTES:
      ${contextText}
      
      CRITICAL QUALITY RULES:
      1. HIGH-YIELD CONCEPTS ONLY: Prioritize main ideas, core definitions, formulas, and overarching themes. Ignore trivial details, random dates, or minor examples.
      2. ZERO HALLUCINATION: Every answer MUST be explicitly supported by the text provided.
      3. QUANTITY: You MUST generate exactly ${numQuestions} questions. Do not stop early. If the notes are short, create questions that test deeper understanding, application, or different angles of the available facts.
      
      FORMAT RULES:
      - Return ONLY a valid JSON array. No markdown, no backticks, no text outside the JSON.
      - CRITICAL JSON RULE: Every key and string value MUST be wrapped in double quotes. Do NOT put double quotes INSIDE the actual text (use single quotes ' ' instead).
      - "multiple_choice": EXACTLY 4 choices as a JSON object with keys "A", "B", "C", "D". The answer must be just the letter.
      - "identification": A question requiring a 1-3 word answer. Leave "choices" as {}.
      
      EXACT FORMAT:
      [
        {
          "type": "multiple_choice",
          "question": "Which of the following is...?",
          "choices": { "A": "Choice 1", "B": "Choice 2", "C": "Choice 3", "D": "Choice 4" },
          "answer": "A",
          "explanation": "This is correct because..."
        }
      ]
    `

    // Use Llama 3 via OpenRouter to generate the quiz JSON
    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct",
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
    
    // 🌟 NEW: Safely attempt to parse the JSON
    let questions;
    try {
      questions = JSON.parse(cleanJsonString);
    } catch (parseError) {
      console.error("The AI generated broken JSON:", parseError);
      return { 
        success: false, 
        error: "The AI got confused while formatting your quiz. Try asking for fewer questions (like 5 or 10)!" 
      };
    }

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
      type: q.type // <--- It grabs the exact type the AI generated!
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

