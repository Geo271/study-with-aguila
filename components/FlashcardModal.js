'use client'

import { useState, useEffect, useCallback } from 'react'
import { Icon } from '@/components/Icons'

// ── Native 8-Bit Audio Effects for Flashcards ──────────────────────────
function playCardAudio(type = 'flip') {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    if (type === 'flip') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.06)
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.08)
    } else if (type === 'master') {
      [523.25, 659.25, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + i * 0.06)
        gain.gain.setValueAtTime(0.04, now + i * 0.06)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.08)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.06)
        osc.stop(now + i * 0.06 + 0.09)
      })
    } else if (type === 'review') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(280, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12)
      gain.gain.setValueAtTime(0.03, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.12)
    }
  } catch (e) {
    // Audio context not supported or restricted
  }
}

export default function FlashcardModal({
  isOpen,
  onClose,
  cards = [],
  isLoading = false,
  onGainXP = null,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [masteredCount, setMasteredCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [slideDirection, setSlideDirection] = useState(null) // 'right' | 'left' | null
  const [isTransitioning, setIsTransitioning] = useState(false)

  const currentCard = cards[currentIndex] || {
    front: 'Loading flashcard...',
    back: 'Please wait...',
    hint: '',
    topic: 'Core Concept',
  }

  const handleFlip = useCallback(() => {
    if (isTransitioning) return
    playCardAudio('flip')
    setIsFlipped(f => !f)
  }, [isTransitioning])

  const handleNext = useCallback((mastered = false) => {
    if (isTransitioning) return

    setIsTransitioning(true)
    setSlideDirection(mastered ? 'right' : 'left')
    playCardAudio(mastered ? 'master' : 'review')

    if (mastered) {
      setMasteredCount(c => c + 1)
      if (onGainXP) onGainXP(15)
    }

    setTimeout(() => {
      setIsFlipped(false)
      setShowHint(false)
      setSlideDirection(null)

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(i => i + 1)
      } else {
        setIsFinished(true)
      }
      setIsTransitioning(false)
    }, 240)
  }, [currentIndex, cards.length, onGainXP, isTransitioning])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || isFinished || isLoading) return

    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleFlip()
      } else if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault()
        handleNext(false)
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext(true)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFinished, isLoading, isFlipped, currentIndex, isTransitioning, handleFlip, handleNext, onClose])

  const handleRestart = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowHint(false)
    setMasteredCount(0)
    setIsFinished(false)
    setSlideDirection(null)
    setIsTransitioning(false)
  }

  if (!isOpen) return null

  const progressPercent = cards.length > 0
    ? Math.round(((currentIndex + (isFinished ? 1 : 0)) / cards.length) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-chat-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border-2 border-neutral-700/80 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.95)] overflow-hidden text-neutral-100 flex flex-col">
        {/* Retro Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 inline-block shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            <div className="flex items-center gap-1.5">
              {Icon.cards('w-4 h-4 text-amber-400')}
              <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
                Active Recall Drill
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
              [SPACE] flip &bull; [1] review &bull; [2] master
            </span>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              title="Close modal (Esc)"
            >
              {Icon.x('w-4 h-4')}
            </button>
          </div>
        </div>

        {/* Progress Tracker Line */}
        <div className="w-full bg-neutral-950 h-1 relative overflow-hidden border-b border-neutral-800/80">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {isLoading ? (
          <div className="p-14 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-amber-300">Extracting high-yield recall cards from your notes...</p>
            <p className="text-[11px] text-neutral-500 font-mono">Synthesizing key definitions and exam test points</p>
          </div>
        ) : isFinished ? (
          /* Finished Victory Screen */
          <div className="p-8 flex flex-col items-center text-center gap-4 animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-400 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
              {Icon.trophy('w-8 h-8 text-amber-400')}
            </div>
            <div>
              <h4 className="text-lg font-bold text-white font-mono uppercase tracking-tight">
                Deck Mastered!
              </h4>
              <p className="text-xs text-neutral-300 mt-1">
                You successfully mastered <span className="text-emerald-400 font-bold font-mono tabular-nums">{masteredCount}</span> of {cards.length} cards.
              </p>
            </div>

            <div className="px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-amber-300 flex items-center gap-1.5 shadow-inner">
              {Icon.bolt('w-3.5 h-3.5 text-amber-400')}
              <span>+{masteredCount * 15} EXP Awarded to Aguila</span>
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
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-mono font-bold text-white transition-all shadow-sm"
              >
                Back to Study Session
              </button>
            </div>
          </div>
        ) : (
          /* Active Flashcard Screen with 3D Flip & Directional Swipe */
          <div className="p-5 flex flex-col">
            {/* Meta bar */}
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-3 select-none">
              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {currentCard.topic || 'Core Concept'}
              </span>
              <span className="text-neutral-500 tabular-nums font-mono">
                Card <span className="text-white font-bold">{currentIndex + 1}</span> of {cards.length}
              </span>
            </div>

            {/* ── 3D Card Flip Perspective Container ─────────────────────── */}
            <div
              style={{ perspective: '1200px' }}
              className="w-full min-h-[240px] select-none"
            >
              <div
                onClick={handleFlip}
                role="button"
                tabIndex={0}
                className="relative w-full min-h-[240px] transition-all duration-300 ease-out cursor-pointer group focus:outline-none"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: `
                    ${slideDirection === 'right' ? 'translateX(100px) rotate(8deg) scale(0.95)' : ''}
                    ${slideDirection === 'left' ? 'translateX(-100px) rotate(-8deg) scale(0.95)' : ''}
                    ${!slideDirection ? (isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)') : ''}
                  `,
                  opacity: slideDirection ? 0 : 1,
                  transition: slideDirection ? 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)' : 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              >
                {/* ── FRONT FACE ─────────────────────────────────────────── */}
                <div
                  className="absolute inset-0 w-full h-full bg-neutral-950 border-2 border-neutral-800 group-hover:border-amber-400/80 rounded-2xl p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)]"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 uppercase">
                    <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Question (Front)
                    </span>
                    <span className="text-amber-400/80 group-hover:text-amber-300 transition-colors flex items-center gap-1">
                      <span>Click to flip</span>
                      <span>↻</span>
                    </span>
                  </div>

                  <div className="my-auto py-3">
                    <p className="text-base sm:text-lg font-semibold text-white leading-relaxed font-sans">
                      {currentCard.front}
                    </p>
                  </div>

                  {/* Hint Section */}
                  <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between text-[11px]">
                    {currentCard.hint ? (
                      showHint ? (
                        <span className="text-amber-300 font-mono italic flex items-center gap-1.5">
                          {Icon.lightbulb('w-3.5 h-3.5 text-amber-400 flex-shrink-0')}
                          <span>Hint: {currentCard.hint}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowHint(true) }}
                          className="text-neutral-500 hover:text-amber-300 font-mono transition-colors flex items-center gap-1"
                        >
                          {Icon.lightbulb('w-3.5 h-3.5 text-neutral-400')}
                          <span>Show Clue / Hint</span>
                        </button>
                      )
                    ) : (
                      <span className="text-neutral-600 font-mono text-[10px]">Active recall mode</span>
                    )}
                  </div>
                </div>

                {/* ── BACK FACE (180deg rotated) ─────────────────────────── */}
                <div
                  className="absolute inset-0 w-full h-full bg-neutral-950 border-2 border-emerald-500/80 group-hover:border-emerald-400 rounded-2xl p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)]"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 uppercase">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Model Answer (Back)
                    </span>
                    <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors flex items-center gap-1">
                      <span>Click to flip back</span>
                      <span>↺</span>
                    </span>
                  </div>

                  <div className="my-auto py-3 overflow-y-auto max-h-[140px] retro-scroll">
                    <p className="text-sm sm:text-base text-neutral-100 leading-relaxed font-sans font-medium">
                      {currentCard.back}
                    </p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                    <span>How well did you know this?</span>
                    <span className="text-emerald-400">Use buttons below</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Response Buttons with Directional Hints */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleNext(false)}
                disabled={isTransitioning}
                className="py-2.5 px-3 rounded-xl border border-neutral-800 hover:border-amber-500/50 bg-neutral-950 hover:bg-amber-500/10 text-xs font-mono text-neutral-300 hover:text-amber-300 transition-all flex items-center justify-center gap-2 group shadow-xs active:translate-y-0.5"
              >
                {Icon.xCircle('w-4 h-4 text-amber-400 group-hover:-translate-x-0.5 transition-transform')}
                <div className="text-left">
                  <div className="font-semibold">Need Review</div>
                  <div className="text-[9px] text-neutral-500 font-mono">[1] Repeat later</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNext(true)}
                disabled={isTransitioning}
                className="py-2.5 px-3 rounded-xl border border-neutral-800 hover:border-emerald-500/50 bg-neutral-950 hover:bg-emerald-500/10 text-xs font-mono font-semibold text-neutral-300 hover:text-emerald-400 transition-all flex items-center justify-center gap-2 group shadow-xs active:translate-y-0.5"
              >
                {Icon.checkCircle('w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform')}
                <div className="text-left">
                  <div className="text-emerald-400 font-bold">Mastered</div>
                  <div className="text-[9px] text-emerald-500/70 font-mono">[2] +15 EXP</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
