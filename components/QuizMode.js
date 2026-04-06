'use client'

import { useState } from 'react'

export default function QuizMode({ questions, onFinish, onRetake }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)

  const question = questions[current]
  const total = questions.length
  const progress = (current / total) * 100

  // Smart validation that handles both clicking an option AND typing an answer
  const isCorrectAnswer = (userAnswer, correctAnswer, type) => {
    if (!userAnswer) return false;
    if (type === 'identification') {
      return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    }
    return userAnswer === correctAnswer;
  }

  const handleNext = () => {
    const isCorrect = isCorrectAnswer(selected, question.answer, question.type)
    
    const newAnswers = [...answers, {
      question: question.question,
      selected,
      correct: question.answer,
      isCorrect: isCorrect
    }]
    setAnswers(newAnswers)

    if (current + 1 >= total) {
      setFinished(true)
    } else {
      setCurrent(current + 1)
      setSelected('')
      setShowResult(false)
    }
  }

  if (finished) {
    const score = answers.filter(a => a.isCorrect).length
    const percentage = Math.round((score / total) * 100)
    const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '👍' : '📚'
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-6xl mb-4">{emoji}</div>
        <h2 className="text-2xl font-bold text-white mb-1">Quiz Complete!</h2>
        
        <div className="bg-neutral-800 rounded-2xl p-6 w-full max-w-xs border border-neutral-700 mt-4 mb-6">
          <div className="text-5xl font-bold text-indigo-400 mb-1">{score}/{total}</div>
          <div className="text-neutral-400 text-sm mb-4">{percentage}% correct</div>
        </div>

        <div className="w-full max-w-lg space-y-2 mb-6 text-left max-h-64 overflow-y-auto pr-2">
          {answers.map((a, i) => (
            <div key={i} className={`p-3 rounded-xl border text-sm flex flex-col gap-1 ${
              a.isCorrect ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 font-bold">{a.isCorrect ? '✓' : '✗'}</span>
                <span className="font-medium text-white">{a.question}</span>
              </div>
              {!a.isCorrect && (
                <div className="ml-6 text-xs text-red-400/80">
                  You said: <span className="line-through">{a.selected}</span> <br/>
                  Correct: <span className="font-bold text-green-400">{a.correct}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetake} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">Retake Quiz</button>
          <button onClick={onFinish} className="px-6 py-2.5 bg-neutral-800 text-neutral-300 rounded-xl text-sm font-medium border border-neutral-700 hover:bg-neutral-700">Back to Chat</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <div className="flex justify-between text-xs text-neutral-500 mb-2">
          <span className="uppercase tracking-wider font-bold text-indigo-400/80">
            {question.type === 'identification' ? 'Identification' : 'Multiple Choice'}
          </span>
          <span>Question {current + 1} of {total}</span>
        </div>
        <div className="w-full bg-neutral-700 rounded-full h-1">
          <div className="bg-indigo-500 h-1 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <h3 className="text-lg font-medium text-white mb-6 leading-relaxed">
        {question.question}
      </h3>

      {question.type === 'multiple_choice' && (
        <div className="space-y-3 mb-6">
          {Object.entries(question.choices || {}).map(([letter, opt]) => {
            let style = 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:border-indigo-500/60'
            
            if (showResult) {
              if (letter === question.answer) style = 'bg-green-500/15 border-green-500/60 text-green-300'
              else if (letter === selected) style = 'bg-red-500/15 border-red-500/60 text-red-300'
              else style = 'bg-neutral-800 border-neutral-700/50 text-neutral-500 opacity-50'
            }

            return (
              <button key={letter} onClick={() => { setSelected(letter); setShowResult(true) }} disabled={showResult}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center gap-3 ${style}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  showResult && letter === question.answer ? 'bg-green-500/30' :
                  showResult && letter === selected ? 'bg-red-500/30' : 'bg-neutral-700/50'
                }`}>
                  {letter}
                </span>
                <span className="text-sm">{opt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* RENDER IDENTIFICATION */}
      {question.type === 'identification' && (
        <div className="mb-6 space-y-4">
          <input 
            type="text" 
            value={selected} 
            onChange={(e) => setSelected(e.target.value)}
            disabled={showResult}
            placeholder="Type your answer here..."
            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            onKeyDown={(e) => { if(e.key === 'Enter' && selected && !showResult) setShowResult(true) }}
          />
          {!showResult && (
            <button onClick={() => setShowResult(true)} disabled={!selected.trim()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700">
              Submit Answer
            </button>
          )}
          
          {showResult && (
            <div className={`p-4 rounded-xl border text-sm ${isCorrectAnswer(selected, question.answer, 'identification') ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
               <p className="mb-1">Correct Answer: <strong className="text-white">{question.answer}</strong></p>
            </div>
          )}
        </div>
      )}

      {/* EXPLANATION FOOTER */}
      {showResult && (
        <div className="space-y-3 mt-auto">
          <div className="bg-neutral-800/80 border border-neutral-700 rounded-xl p-4 text-sm text-neutral-300 leading-relaxed">
            <span className="font-semibold text-indigo-400">Explanation: </span>
            {question.explanation}
          </div>
          <button onClick={handleNext}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-all">
            {current + 1 >= total ? '🎯 See Results' : 'Next Question →'}
          </button>
        </div>
      )}
    </div>
  )
}