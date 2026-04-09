'use client'

import { useState } from 'react'
import { saveQuizResult, saveWrongAnswers } from '@/app/actions/quiz'
import { Icon } from '@/components/Icons'

export default function QuizMode({ questions, quizId, userId, onFinish, onRetake }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  const question = questions[current]
  const total = questions.length
  const progress = ((current + (showResult ? 1 : 0)) / total) * 100

  const isCorrectAnswer = (userAnswer, correctAnswer, type) => {
    if (!userAnswer) return false
    if (type === 'identification') {
      return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
    }
    return userAnswer === correctAnswer
  }

  const handleNext = async () => {
    const isCorrect = isCorrectAnswer(selected, question.answer, question.type)
    const newAnswers = [...answers, {
      question: question.question,
      selected,
      correct: question.answer,
      isCorrect,
      type: question.type,
    }]
    setAnswers(newAnswers)

    if (current + 1 >= total) {
      setSaving(true)
      const score = newAnswers.filter(a => a.isCorrect).length
      const wrongAnswers = newAnswers.filter(a => !a.isCorrect)

      if (quizId && userId) {
        await Promise.all([
          saveQuizResult(quizId, userId, score, total),
          saveWrongAnswers(quizId, userId, wrongAnswers),
        ])
      }
      setSaving(false)
      setFinished(true)
    } else {
      setCurrent(c => c + 1)
      setSelected('')
      setShowResult(false)
    }
  }

  // ── Results screen ────────────────────────────────────────────────
  if (finished) {
    const score = answers.filter(a => a.isCorrect).length
    const pct = Math.round((score / total) * 100)
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'
    const msg = pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good effort!' : 'Keep reviewing.'
    const wrongAnswers = answers.filter(a => !a.isCorrect)

    return (
      <div className="flex flex-col h-full overflow-y-auto p-5 sm:p-7">
        {/* Score card */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{emoji}</div>
          <h2 className="text-xl font-bold text-white mb-1">Quiz complete</h2>
          <p className="text-neutral-500 text-sm">{msg}</p>

          <div className="inline-flex items-center gap-4 bg-neutral-800 border border-neutral-700 rounded-2xl px-6 py-4 mt-4">
            <div>
              <div className="text-4xl font-bold text-indigo-400">{score}/{total}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{pct}% correct</div>
            </div>
            <div className="w-px h-12 bg-neutral-700"/>
            <div>
              <div className="text-2xl font-bold text-green-400">{score}</div>
              <div className="text-xs text-neutral-500">correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{wrongAnswers.length}</div>
              <div className="text-xs text-neutral-500">wrong</div>
            </div>
          </div>

          <div className="w-full max-w-xs mx-auto mt-3">
            <div className="w-full bg-neutral-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Wrong answers review */}
        {wrongAnswers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-red-500/20 flex items-center justify-center text-red-400 text-xs">!</span>
              Items to review ({wrongAnswers.length})
            </h3>
            <div className="space-y-2">
              {wrongAnswers.map((a, i) => (
                <div key={i} className="bg-red-500/8 border border-red-500/20 rounded-xl p-3.5">
                  <p className="text-sm font-medium text-neutral-200 mb-2">{a.question}</p>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-red-400 font-medium flex-shrink-0">Your answer:</span>
                      <span className="text-red-400 line-through">{a.selected || '(no answer)'}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-green-400 font-medium flex-shrink-0">Correct:</span>
                      <span className="text-green-300 font-medium">{a.correct}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-auto pt-2">
          <button
            onClick={onRetake}
            className="flex-1 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            {Icon.refresh('w-4 h-4')}
            New quiz
          </button>
          <button
            onClick={onFinish}
            className="flex-1 py-3 bg-neutral-800 text-neutral-300 text-sm font-medium rounded-xl hover:bg-neutral-700 border border-neutral-700 transition-all"
          >
            Back to chat
          </button>
        </div>
      </div>
    )
  }

  // ── Question screen ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full p-5 sm:p-7">
      {/* Progress */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-neutral-500 mb-2">
          <span className="font-semibold text-indigo-400 uppercase tracking-wide text-xs">
            {question.type === 'identification' ? 'Identification' : 'Multiple choice'}
          </span>
          <span>Question {current + 1} of {total}</span>
        </div>
        <div className="w-full bg-neutral-800 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h3 className="text-base sm:text-lg font-medium text-white mb-6 leading-relaxed">
        {question.question}
      </h3>

      {/* Multiple choice */}
      {question.type === 'multiple_choice' && (
        <div className="space-y-2.5 mb-5">
          {Object.entries(question.choices || {}).map(([letter, opt]) => {
            let cls = 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:border-indigo-500/60 cursor-pointer'
            if (showResult) {
              if (letter === question.answer) cls = 'bg-green-500/15 border-green-500/60 text-green-300 cursor-default'
              else if (letter === selected) cls = 'bg-red-500/15 border-red-500/60 text-red-300 cursor-default'
              else cls = 'bg-neutral-800 border-neutral-700/40 text-neutral-600 opacity-50 cursor-default'
            }
            return (
              <button
                key={letter}
                onClick={() => { if (!showResult) { setSelected(letter); setShowResult(true) } }}
                disabled={!!showResult}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center gap-3 ${cls}`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  showResult && letter === question.answer ? 'bg-green-500/30 text-green-300' :
                  showResult && letter === selected ? 'bg-red-500/30 text-red-300' : 'bg-neutral-700 text-neutral-400'
                }`}>
                  {letter}
                </span>
                <span className="text-sm">{opt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Identification */}
      {question.type === 'identification' && (
        <div className="mb-5 space-y-3">
          <input
            type="text" value={selected}
            onChange={e => setSelected(e.target.value)}
            disabled={showResult}
            placeholder="Type your answer..."
            onKeyDown={e => { if (e.key === 'Enter' && selected && !showResult) setShowResult(true) }}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 text-sm"
          />
          {!showResult && (
            <button
              onClick={() => { if (selected.trim()) setShowResult(true) }}
              disabled={!selected.trim()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-indigo-700 transition-all"
            >
              Submit answer
            </button>
          )}
          {showResult && (
            <div className={`p-3.5 rounded-xl border text-sm ${
              isCorrectAnswer(selected, question.answer, 'identification')
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              Correct answer: <strong className="text-white">{question.answer}</strong>
            </div>
          )}
        </div>
      )}

      {/* Explanation + Next */}
      {showResult && (
        <div className="space-y-3 mt-auto">
          <div className="bg-neutral-800/80 border border-neutral-700/70 rounded-xl p-4 text-sm text-neutral-300 leading-relaxed">
            <span className="font-semibold text-indigo-400">Explanation: </span>
            {question.explanation}
          </div>
          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <>{Icon.spinner('w-4 h-4')} Saving...</> : current + 1 >= total ? 'See results' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  )
}