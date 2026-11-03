'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

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
  sm: { width: 76, shadow: 'w-16', aura: 'w-24 h-24' },
  md: { width: 108, shadow: 'w-24', aura: 'w-32 h-32' },
  lg: { width: 148, shadow: 'w-32', aura: 'w-44 h-44' },
  xl: { width: 184, shadow: 'w-40', aura: 'w-52 h-52' },
}

export default function AguiMascot({
  mood = 'idle',
  size = 'md',
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
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md

  // Rotate guidance steps smoothly every 8 seconds when idle and no custom message is present
  useEffect(() => {
    if (customMessage || guidanceText) return

    timerRef.current = setInterval(() => {
      setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
      setInteractiveMsg(null)
      setBubbleKey(k => k + 1)
    }, 8000)

    return () => clearInterval(timerRef.current)
  }, [customMessage, guidanceText])

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (nodTimeoutRef.current) clearTimeout(nodTimeoutRef.current)
    }
  }, [])

  // Acknowledging thoughtful nod when clicked (zero cartoon bouncing)
  const handleMascotInteract = useCallback(() => {
    setIsNodding(false)
    if (nodTimeoutRef.current) clearTimeout(nodTimeoutRef.current)

    setTimeout(() => {
      setIsNodding(true)
      nodTimeoutRef.current = setTimeout(() => setIsNodding(false), 360)
    }, 10)

    // Spawn subtle ambient motivation spark
    const newId = Date.now() + Math.random()
    const sparkItems = ['💡 Key Concept', '⚡ Focus Locked', '🦅 Eye on Goal', '🎯 Active Recall']
    const spark = sparkItems[Math.floor(Math.random() * sparkItems.length)]
    const randomTx = Math.floor(Math.random() * 30) - 15

    setParticles(prev => [
      ...prev.slice(-3),
      { id: newId, text: spark, tx: `${randomTx}px` }
    ])

    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newId))
    }, 850)

    // Cycle to next guidance tip or responsive study quip
    setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
    setInteractiveMsg("Click any study tool below or ask me a question in chat — I'm right here to guide you.")
    setBubbleKey(k => k + 1)
  }, [])

  const handleBubbleCycle = () => {
    setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
    setInteractiveMsg(null)
    setBubbleKey(k => k + 1)
  }

  // Determine current active message and badge
  const activeGuide = GUIDANCE_STEPS[guideIndex]
  const currentBadge = guidanceBadge || (guidanceText ? 'Action Guide' : (interactiveMsg ? 'Agui Study Tip' : (customMessage ? 'Status' : activeGuide.badge)))
  const displayMsg = guidanceText || interactiveMsg || customMessage || (mood === 'idle' ? activeGuide.text : messages[0])

  const isThinking = mood === 'thinking'
  const isStudying = mood === 'studying'
  const isTimer = mood === 'timer'

  // Lifelike motion: gentle breathing stance (no bouncing!)
  let motionClass = 'animate-aguila-alive'
  if (isStudying || isThinking) {
    motionClass = 'animate-aguila-studying'
  }

  return (
    <div className="flex flex-col items-center select-none relative max-w-sm mx-auto">
      {/* Speech bubble / Intelligent Study Guide */}
      {showBubble && (
        <div 
          key={bubbleKey}
          onClick={handleBubbleCycle}
          title="Click to cycle study guide"
          className="relative mb-3.5 max-w-[290px] sm:max-w-[320px] cursor-pointer group animate-aguila-bubble focus:outline-none z-20"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBubbleCycle() } }}
        >
          <div className="bg-neutral-900/90 border border-neutral-800 group-hover:border-amber-500/40 px-4 py-2.5 rounded-2xl shadow-xl shadow-black/50 text-center backdrop-blur-md transition-colors duration-200">
            {/* Guide badge */}
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 font-mono">
                {currentBadge}
              </span>
            </div>

            <p className="text-xs font-medium text-neutral-200 leading-relaxed">
              {displayMsg}
            </p>

            {isThinking && (
              <span className="inline-flex gap-1.5 items-center justify-center mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-75" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-50" />
              </span>
            )}

            <div className="flex items-center justify-center gap-1 text-[9px] text-neutral-500 mt-1.5 font-mono opacity-60 group-hover:opacity-100 transition-opacity">
              <span>click for next guide step</span>
              <span>➔</span>
            </div>
          </div>

          {/* Speech bubble pointer */}
          <div className="w-2.5 h-2.5 bg-neutral-900/90 border-r border-b border-neutral-800 group-hover:border-amber-500/40 transform rotate-45 mx-auto -mt-1.5 transition-colors duration-200" />
        </div>
      )}

      {/* Floating Guidance Sparks (subtle, non-jarring) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-30">
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute text-[11px] font-semibold text-amber-300 font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-aguila-particle px-2 py-0.5 rounded-full bg-neutral-900/90 border border-amber-500/40"
            style={{ '--p-tx': p.tx }}
          >
            {p.text}
          </span>
        ))}
      </div>

      {/* Mascot Graphic with Ambient Backlight & Lifelike Idle Motion */}
      <div 
        className="relative flex flex-col items-center justify-center cursor-pointer aguila-clickable focus:outline-none"
        onClick={handleMascotInteract}
        role="button"
        tabIndex={0}
        aria-label="Agui the study guide mascot - click for a study tip"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleMascotInteract()
          }
        }}
        style={{ animationDelay }}
      >
        {/* Soft Ambient Radial Backlight - Blends smoothly into the dark background */}
        <div 
          className={`absolute ${sizeConfig.aura} rounded-full bg-radial from-amber-500/10 via-amber-500/5 to-transparent blur-xl pointer-events-none animate-aguila-aura`}
          style={{ top: '10%' }}
        />

        {/* Mascot Sprite with Organic Breathing Poise (NO Bouncing) */}
        <div 
          className={`relative z-10 transition-transform ${motionClass} ${
            isNodding ? 'animate-aguila-nod' : ''
          }`}
        >
          <Image
            src={mascotSrc}
            alt={`Aguila mascot - ${mood}`}
            width={sizeConfig.width}
            height={sizeConfig.width}
            className="aguila-sprite object-contain drop-shadow-md select-none pointer-events-none transition-all duration-300"
            style={{
              imageRendering: 'pixelated',
              width: `${sizeConfig.width}px`,
              height: `${sizeConfig.width}px`,
            }}
            priority
            unoptimized
          />

          {/* Active study status indicator */}
          {isTimer && (
            <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-neutral-950" />
            </span>
          )}
        </div>

        {/* Realistic Ground Contact Shadow */}
        <div 
          className={`${sizeConfig.shadow} h-3 bg-neutral-950/70 rounded-[50%] blur-[2px] mt-[-4px] animate-aguila-shadow transition-all`}
        />
      </div>

      {/* Clickable Quick Guidance Starter Chips (if provided) */}
      {onQuickPrompt && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-sm px-2">
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation()
                onQuickPrompt(item.prompt)
              }}
              className="text-[11px] font-medium text-neutral-400 hover:text-amber-300 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/30 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
            >
              <span>{item.label}</span>
              <span className="text-[10px] text-neutral-600">➔</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
