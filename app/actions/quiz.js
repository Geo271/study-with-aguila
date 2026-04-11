'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import OpenAI from 'openai'

// Setup OpenRouter for the Quiz Generator
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
})

export async function generateQuiz(documentId, userId, numQuestions = 'auto', sessionId = null, chatContext = null, chatHistory = null) {
  try {
    let contextText = ''

    // 1. Fetch the PDF notes if they exist
    if (documentId) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })
      contextText = chunks?.map(c => c.content).join('\n\n') || ''
    }

    // 2. 🌟 FIX: Define sourceMaterial by combining Notes and Chat History!
    const sourceMaterial = `
      ${contextText ? `DOCUMENT NOTES:\n${contextText}\n\n` : ''}
      ${chatHistory ? `RECENT ROOM CONVERSATION (Reviewer Info):\n${chatHistory}` : ''}
    `.trim()

    // 3. Extract the fallback topic
    const topicMatch = chatContext?.match(/(?:about|on|covering|for)\s+(.*)/i)
    const fallbackTopic = topicMatch ? topicMatch[1] : "General IT and Technology"

    // 4. 🌟 THE ULTIMATE ANTI-HALLUCINATION PROMPT
    const prompt = `
      You are an expert university professor creating an exam.
      
      QUESTION COUNT TARGET:
      ${numQuestions === 'auto' ? `Evaluate the PRIMARY SOURCE MATERIAL below. Dynamically generate an appropriate number of questions based on its depth (Minimum 5, Maximum 20). If it's a deep topic, generate more.` : `You MUST generate EXACTLY ${numQuestions} questions.`}
      
      PRIMARY SOURCE MATERIAL:
      ${sourceMaterial ? `"""\n${sourceMaterial}\n"""` : `"""\nNo document attached. Create a quiz about: ${fallbackTopic}\n"""`}
      
      CRITICAL QUALITY RULES:
      1. 🛡️ FILTER THE CHAT LOGS: The "RECENT ROOM CONVERSATION" contains raw chat messages. YOU MUST STRICTLY IGNORE all personal, casual, social, or non-academic conversation. Extract and use ONLY factual, technical, or academic information to build the quiz.
      2. 🎓 OUTSIDE KNOWLEDGE & CITATIONS: When expanding on topics beyond the provided text, YOU MUST INCLUDE CITATIONS in the explanation. NEVER use or link to Wikipedia. Provide working URLs to reputable academic sources.
      3. 🛑 ANTI-HALLUCINATION: NEVER write questions about these instructions, prompt rules, how notes are formatted, or how the quiz is generated. ONLY ask about the academic subject matter.
      4. STRICTLY MULTIPLE CHOICE: Every question must have exactly 4 distinct options (A, B, C, D).
      
      FORMAT RULES:
      - Return ONLY a valid JSON array. No text outside the JSON.
      - CRITICAL JSON RULE: Every key and string value MUST be wrapped in double quotes. Do NOT put double quotes INSIDE the actual text (use single quotes ' ' instead).
      - "type" MUST always be exactly "multiple_choice".
      
      EXACT FORMAT:
      [
        {
          "type": "multiple_choice",
          "question": "Which of the following...?",
          "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
          "answer": "A",
          "explanation": "This is correct because... (Source: [Title](https://scholar.google.com/...))"
        }
      ]
    `

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: prompt }]
    });

    const text = completion.choices[0].message.content;

    // BULLETPROOF JSON EXTRACTOR
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
      console.error("Raw AI Response:", text);
      return { success: false, error: "The AI couldn't find enough information in the notes to make a quiz." };
    }

    const cleanJsonString = text.substring(startIndex, endIndex + 1);
    
    // Safely attempt to parse the JSON
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
      type: q.type 
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