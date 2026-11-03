'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const GUIDANCE_STEPS = [
  {
    badge: 'Guide Step 1',
    text: "Upload your PDF notes or syllabus below — I'll index key concepts and prepare practice quizzes for you.",
  },
  {
    badge: 'Guide Step 2',
    text: "Ask me any tough concept in the chat bar. I explain step-by-step and cite directly from your material.",
  },
  {
    badge: 'Guide Step 3',
    text: "Ready to test your memory? Click 'Start Quiz' to run active recall practice questions.",
  },
  {
    badge: 'Study Tip',
    text: "Use spaced repetition: review your uploaded notes in 20-minute focused blocks for 200% better retention.",
  },
  {
    badge: 'Student Lounge',
    text: "Need group accountability? Head over to the Student Lounge to study together in live voice rooms.",
  },
]

const QUICK_PROMPTS = [
  { label: 'Summarize key concepts', prompt: 'Summarize the most important concepts and definitions from my notes.' },
  { label: 'Generate practice quiz', prompt: 'Create 5 practice quiz questions based on the key topics in my uploaded notes.' },
  { label: 'Explain like a beginner', prompt: 'Explain the most complex topic in my material in simple, plain English with an analogy.' },
]

const MOOD_MESSAGES = {
  idle: [
    "I'm your study companion. What are we mastering today?",
    "Upload a PDF or scan notes to begin your study session.",
    "Ready to turn complex lectures into clear takeaways.",
  ],
  studying: [
    "Reading through your notes carefully...",
    "Extracting key concepts and building vector embeddings...",
    "Analyzing your study material for the best breakdown...",
  ],
  celebrating: [
    "Outstanding progress! You're building real mastery.",
    "Excellent work! Your consistency is paying off.",
    "Keep this focus going — you're fully prepared.",
  ],
  thinking: [
    "Searching your uploaded notes for the exact reference...",
    "Synthesizing key insights from your material...",
    "Formulating a clear academic explanation...",
  ],
  timer: [
    "Deep focus session active. Zero distractions.",
    "Stay in the flow — high cognitive retention in progress.",
    "Pacing your brain for peak exam performance.",
  ],
}

const MASCOT_IMAGES = {
  idle: '/mascot-idle.png',
  studying: '/mascot-studying.png',
  thinking: '/mascot-studying.png',
  celebrating: '/mascot-celebrating.png',
  timer: '/mascot-timer.png',
}

const SIZE_MAP = {
  sm: { width: 84, shadow: 'w-16' },
  md: { width: 120, shadow: 'w-24' },
  lg: { width: 160, shadow: 'w-32' },
  xl: { width: 196, shadow: 'w-40' },
}

const RETRO_SPARKS = ['+15 EXP ⚡', 'FOCUS +1 🎯', 'STREAK x3 🔥', 'CRITICAL RECALL 🧠', 'LEVEL UP! 🌟']

export default function AguiMascot({
  mood = 'idle',
  size = 'lg',
  showBubble = true,
  customMessage = '',
  guidanceText = '',
  guidanceBadge = '',
  onQuickPrompt = null,
  animationDelay = '0s',
}) {
  const [guideIndex, setGuideIndex] = useState(0)
  const [isNodding, setIsNodding] = useState(false)
  const [particles, setParticles] = useState([])
  const [bubbleKey, setBubbleKey] = useState(0)
  const [interactiveMsg, setInteractiveMsg] = useState(null)

  const timerRef = useRef(null)
  const nodTimeoutRef = useRef(null)

  const messages = MOOD_MESSAGES[mood] || MOOD_MESSAGES.idle
  const mascotSrc = MASCOT_IMAGES[mood] || MASCOT_IMAGES.idle
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.lg

  // Rotate guidance steps smoothly every 8 seconds when idle
  useEffect(() => {
    if (customMessage || guidanceText) return

    timerRef.current = setInterval(() => {
      setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
      setInteractiveMsg(null)
      setBubbleKey(k => k + 1)
    }, 8000)

    return () => clearInterval(timerRef.current)
  }, [customMessage, guidanceText])

  useEffect(() => {
    return () => {
      if (nodTimeoutRef.current) clearTimeout(nodTimeoutRef.current)
    }
  }, [])

  // Thoughtful retro interaction
  const handleMascotInteract = useCallback(() => {
    setIsNodding(false)
    if (nodTimeoutRef.current) clearTimeout(nodTimeoutRef.current)

    setTimeout(() => {
      setIsNodding(true)
      nodTimeoutRef.current = setTimeout(() => setIsNodding(false), 360)
    }, 10)

    // Spawn retro 16-bit floating stat badge
    const newId = Date.now() + Math.random()
    const spark = RETRO_SPARKS[Math.floor(Math.random() * RETRO_SPARKS.length)]
    const randomTx = Math.floor(Math.random() * 32) - 16

    setParticles(prev => [
      ...prev.slice(-3),
      { id: newId, text: spark, tx: `${randomTx}px` }
    ])

    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newId))
    }, 850)

    setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
    setInteractiveMsg("Click any study tool below or ask me a question in chat — I'm right here to guide you.")
    setBubbleKey(k => k + 1)
  }, [])

  const handleBubbleCycle = () => {
    setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
    setInteractiveMsg(null)
    setBubbleKey(k => k + 1)
  }

  const activeGuide = GUIDANCE_STEPS[guideIndex]
  const currentBadge = guidanceBadge || (guidanceText ? 'Action Guide' : (interactiveMsg ? 'Agui Study Tip' : (customMessage ? 'Status' : activeGuide.badge)))
  const displayMsg = guidanceText || interactiveMsg || customMessage || (mood === 'idle' ? activeGuide.text : messages[0])

  const isThinking = mood === 'thinking'
  const isStudying = mood === 'studying'
  const isCelebrating = mood === 'celebrating'
  const isTimer = mood === 'timer'

  return (
    <div className="flex flex-col items-center select-none relative max-w-sm mx-auto">
      {/* ── Retro 16-Bit RPG Dialogue Box / Study Guide ── */}
      {showBubble && (
        <div 
          key={bubbleKey}
          onClick={handleBubbleCycle}
          title="Click to cycle study guide"
          className="relative mb-3 max-w-[300px] sm:max-w-[330px] cursor-pointer group animate-aguila-bubble focus:outline-none z-20"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBubbleCycle() } }}
        >
          {/* Retro RPG Dialogue Panel */}
          <div className="bg-neutral-900/95 border-2 border-neutral-700/80 group-hover:border-amber-400/80 px-4 py-2.5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-200">
            {/* Retro Badge Header */}
            <div className="flex items-center justify-between gap-1.5 mb-1 pb-1 border-b border-neutral-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-400 inline-block shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                  {currentBadge}
                </span>
              </div>
              <span className="text-[9px] text-neutral-500 font-mono">
                LVL 5 🦅
              </span>
            </div>

            <p className="text-xs font-medium text-neutral-200 leading-relaxed font-sans">
              {displayMsg}
            </p>

            {isThinking && (
              <span className="inline-flex gap-1.5 items-center justify-center mt-2">
                <span className="w-1.5 h-1.5 bg-amber-400 animate-ping" />
                <span className="w-1.5 h-1.5 bg-amber-400 opacity-75" />
                <span className="w-1.5 h-1.5 bg-amber-400 opacity-50" />
              </span>
            )}

            <div className="flex items-center justify-between text-[9px] text-neutral-500 mt-1.5 font-mono pt-1">
              <span>click for next guide step</span>
              <span className="text-amber-400 animate-pulse font-bold">▼</span>
            </div>
          </div>

          {/* Speech bubble pointer */}
          <div className="w-3 h-3 bg-neutral-900 border-r-2 border-b-2 border-neutral-700/80 group-hover:border-amber-400/80 transform rotate-45 mx-auto -mt-2 transition-colors duration-200" />
        </div>
      )}

      {/* Floating Retro 16-Bit XP / Stat Badges */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-30">
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute text-[11px] font-bold text-amber-300 font-mono drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] animate-aguila-particle px-2 py-0.5 rounded bg-neutral-950 border-2 border-amber-400 shadow-[2px_2px_0px_rgba(0,0,0,0.9)]"
            style={{ '--p-tx': p.tx }}
          >
            {p.text}
          </span>
        ))}
      </div>

      {/* ── Authentic Pixel Art Retro Mascot (Zero Background Box, Pixel Art Scaled) ── */}
      <div 
        className="relative flex flex-col items-center justify-center cursor-pointer aguila-clickable focus:outline-none"
        onClick={handleMascotInteract}
        role="button"
        tabIndex={0}
        aria-label="Agui the retro study guide mascot - click for a study tip"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleMascotInteract()
          }
        }}
        style={{ animationDelay }}
      >
        {/* Soft Ambient Backlight Glow */}
        <div 
          className="absolute w-36 h-36 rounded-full bg-radial from-amber-500/15 via-amber-500/5 to-transparent blur-xl pointer-events-none animate-aguila-aura"
          style={{ top: '10%' }}
        />

        {/* Authentic Pixel Art Character Sprite */}
        <div 
          className={`relative z-10 transition-transform ${
            isStudying || isThinking ? 'animate-aguila-studying' : 'animate-aguila-alive'
          } ${isNodding ? 'animate-aguila-nod' : ''}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mascotSrc}
            alt={`Aguila mascot - ${mood}`}
            width={sizeConfig.width}
            height={sizeConfig.width}
            className="aguila-sprite object-contain select-none pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-all duration-200"
            style={{
              imageRendering: 'pixelated',
              width: `${sizeConfig.width}px`,
              height: `${sizeConfig.width}px`,
            }}
          />

          {/* Active study status indicator */}
          {isTimer && (
            <span className="absolute bottom-2 right-2 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded h-4 w-4 bg-amber-500 border-2 border-neutral-950 font-mono text-[9px] font-bold items-center justify-center text-neutral-950">
                ⏱
              </span>
            </span>
          )}

          {isCelebrating && (
            <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded bg-emerald-500 text-neutral-950 font-mono text-[10px] font-bold border border-emerald-400 shadow-[2px_2px_0px_rgba(0,0,0,0.8)] animate-bounce">
              A+
            </span>
          )}
        </div>

        {/* Realistic Ground Contact Shadow under perch */}
        <div 
          className={`${sizeConfig.shadow} h-3.5 bg-neutral-950/80 rounded-[50%] blur-[2px] mt-[-6px] animate-aguila-shadow transition-all`}
        />
      </div>

      {/* Clickable Quick Guidance Starter Chips */}
      {onQuickPrompt && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5 max-w-sm px-2 z-10">
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation()
                onQuickPrompt(item.prompt)
              }}
              className="text-[11px] font-medium text-neutral-300 hover:text-amber-300 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm font-mono"
            >
              <span>{item.label}</span>
              <span className="text-[10px] text-amber-500 font-bold">➔</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
