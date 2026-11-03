'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icons'

export default function FlashcardModal({ isOpen, onClose, cards = [], isLoading = false, onGainXP = null }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [masteredCount, setMasteredCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  if (!isOpen) return null

  const currentCard = cards[currentIndex] || {
    front: 'Loading flashcard...',
    back: 'Please wait...',
    hint: '',
    topic: 'Study Material',
  }

  const handleNext = (mastered = false) => {
    if (mastered) {
      setMasteredCount(c => c + 1)
      if (onGainXP) onGainXP(15)
    }
    setIsFlipped(false)
    setShowHint(false)

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(i => i + 1)
    } else {
      setIsFinished(true)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowHint(false)
    setMasteredCount(0)
    setIsFinished(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-chat-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border-2 border-neutral-700/80 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.9)] overflow-hidden text-neutral-100 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            {Icon.cards('w-4 h-4 text-amber-400')}
            <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
              Active Recall Flashcard Drill
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            {Icon.x('w-4 h-4')}
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-amber-300">Extracting high-yield recall cards from your notes...</p>
          </div>
        ) : isFinished ? (
          /* Finished Victory Screen */
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-400 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
              {Icon.trophy('w-8 h-8 text-amber-400')}
            </div>
            <div>
              <h4 className="text-lg font-bold text-white font-mono uppercase tracking-tight">
                Drill Completed!
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                You mastered <span className="text-emerald-400 font-bold">{masteredCount}</span> out of {cards.length} concepts in this deck.
              </p>
            </div>

            <div className="px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-amber-300 flex items-center gap-1.5">
              {Icon.bolt('w-3.5 h-3.5 text-amber-400')}
              <span>+{masteredCount * 15} EXP Awarded to Agui</span>
            </div>

            <div className="flex gap-2.5 w-full mt-2">
              <button
                onClick={handleRestart}
                className="flex-1 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-200 transition-all flex items-center justify-center gap-1.5"
              >
                {Icon.refresh('w-3.5 h-3.5')}
                <span>Repeat Drill</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-mono font-bold text-white transition-all"
              >
                Back to Study Session
              </button>
            </div>
          </div>
        ) : (
          /* Active Flashcard Screen */
          <div className="p-5 flex flex-col">
            {/* Meta bar */}
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                {currentCard.topic || 'Core Concept'}
              </span>
              <span className="text-neutral-500 tabular-nums">
                Card {currentIndex + 1} of {cards.length}
              </span>
            </div>

            {/* Flashcard container (clickable flip) */}
            <div
              onClick={() => setIsFlipped(f => !f)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsFlipped(f => !f) } }}
              className="relative min-h-[220px] bg-neutral-950 border-2 border-neutral-800 hover:border-amber-400/80 rounded-2xl p-6 flex flex-col justify-between cursor-pointer select-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] group focus:outline-none"
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 uppercase">
                <span className="flex items-center gap-1">
                  {isFlipped ? (
                    <>
                      {Icon.lightbulb('w-3 h-3 text-amber-400')}
                      <span>Explanation (Back)</span>
                    </>
                  ) : (
                    <span>[?] Question (Front)</span>
                  )}
                </span>
                <span className="text-amber-400/80 group-hover:text-amber-400">
                  {isFlipped ? 'Tap to see prompt' : 'Tap to reveal answer ↻'}
                </span>
              </div>

              <div className="my-auto py-3">
                <p className={`leading-relaxed ${isFlipped ? 'text-sm text-neutral-100 font-sans' : 'text-base font-semibold text-white'}`}>
                  {isFlipped ? currentCard.back : currentCard.front}
                </p>
              </div>

              {/* Hint section */}
              {currentCard.hint && (
                <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between text-[11px]">
                  {showHint ? (
                    <span className="text-amber-300 font-mono italic flex items-center gap-1">
                      {Icon.lightbulb('w-3 h-3 text-amber-400')}
                      <span>Hint: {currentCard.hint}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowHint(true) }}
                      className="text-neutral-500 hover:text-amber-300 font-mono transition-colors flex items-center gap-1"
                    >
                      <span>Show Hint</span>
                      {Icon.lightbulb('w-3 h-3')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Response Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => handleNext(false)}
                className="py-2.5 rounded-xl border border-neutral-800 hover:border-red-500/40 bg-neutral-950 hover:bg-red-500/10 text-xs font-mono text-neutral-300 hover:text-red-400 transition-all flex items-center justify-center gap-1.5"
              >
                {Icon.xCircle('w-3.5 h-3.5 text-red-400')}
                <span>Need Review</span>
              </button>
              <button
                onClick={() => handleNext(true)}
                className="py-2.5 rounded-xl border border-neutral-800 hover:border-emerald-500/40 bg-neutral-950 hover:bg-emerald-500/10 text-xs font-mono font-semibold text-neutral-300 hover:text-emerald-400 transition-all flex items-center justify-center gap-1.5"
              >
                {Icon.checkCircle('w-3.5 h-3.5 text-emerald-400')}
                <span>Mastered (+15 XP)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
