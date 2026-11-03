'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

const FACTS = [
  "The Philippine Eagle is one of the world's largest, most powerful eagles.",
  "Spaced repetition improves long-term recall by up to 200%.",
  "The Feynman Technique: explain it simply to truly understand it.",
  "Sleep consolidates memories — review notes before you rest.",
  "Active recall beats passive re-reading every time.",
  "The Pomodoro method trains your brain to focus on demand.",
  "Teaching others is the fastest way to master a subject.",
  "Philippine Eagles mate for life and are fiercely loyal.",
  "Breaking a big topic into chunks makes it far less overwhelming.",
  "Your brain processes information better in shorter, focused sessions.",
]

const MOOD_MESSAGES = {
  idle: [
    "Drop your notes and let's get to work.",
    "Ready to help you ace your exams.",
    "Upload a PDF and I'll turn it into a study guide.",
    "What are we mastering today?",
    "Ask me anything about your notes.",
  ],
  studying: [
    "Reading through your notes carefully...",
    "Processing your material — this looks interesting.",
    "Finding the key concepts in your notes.",
    "Analyzing content for the best study approach.",
  ],
  celebrating: [
    "Outstanding! You're absolutely crushing it.",
    "Excellent score! Keep this momentum going.",
    "That's the spirit! Real progress right there.",
    "Top marks. You've clearly put in the work.",
  ],
  thinking: [
    "Searching your notes for the best answer...",
    "Connecting the concepts from your material...",
    "Formulating a clear academic explanation...",
  ],
  timer: [
    "Focus mode activated. No distractions.",
    "Your session is running. Stay in the zone.",
    "Concentration is a skill. Build it now.",
    "Break incoming. You earned it.",
  ],
}

const INTERACTION_QUOTES = [
  "*Chirp!* Eagle focus locked on your syllabus!",
  "Petting Aguila grants +5 study momentum! ⚡",
  "Active recall + spaced repetition = unstoppable! 📚",
  "Take a deep breath, scholar. You've got this! 🎯",
  "Zero distractions. Full comprehension mode. 🦅",
  "1% better every single day. Let's conquer it!",
  "Wings spread, sharp mind. Let's fly! ✨",
]

const PARTICLE_EMOJIS = ['+1 Focus', '⚡', '✨', '🦅', '🎯', '📚', '💡', '🔥']

const MASCOT_IMAGES = {
  idle: '/mascot-idle.png',
  studying: '/mascot-studying.png',
  thinking: '/mascot-studying.png',
  celebrating: '/mascot-celebrating.png',
  timer: '/mascot-timer.png',
}

const SIZE_MAP = {
  sm: { width: 72, shadow: 'w-14' },
  md: { width: 104, shadow: 'w-20' },
  lg: { width: 144, shadow: 'w-28' },
  xl: { width: 180, shadow: 'w-36' },
}

export default function AguiMascot({
  mood = 'idle',
  size = 'md',
  showBubble = true,
  customMessage = '',
  animationDelay = '0s',
}) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [factIndex, setFactIndex] = useState(0)
  const [prevMood, setPrevMood] = useState(mood)
  const [isSquishing, setIsSquishing] = useState(false)
  const [particles, setParticles] = useState([])
  const [clickCount, setClickCount] = useState(0)
  const [isHyperCelebration, setIsHyperCelebration] = useState(false)
  const [interactiveQuote, setInteractiveQuote] = useState(null)
  const [bubbleKey, setBubbleKey] = useState(0)

  if (mood !== prevMood) {
    setPrevMood(mood)
    setMsgIndex(0)
    setInteractiveQuote(null)
  }

  const timerRef = useRef(null)
  const factTimerRef = useRef(null)
  const squishTimeoutRef = useRef(null)
  const comboResetTimeoutRef = useRef(null)
  const hyperTimeoutRef = useRef(null)

  const messages = MOOD_MESSAGES[mood] || MOOD_MESSAGES.idle
  const currentMood = isHyperCelebration ? 'celebrating' : mood
  const mascotSrc = MASCOT_IMAGES[currentMood] || MASCOT_IMAGES.idle
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md

  // Automatic speech bubble rotation
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length)
      setInteractiveQuote(null)
      setBubbleKey(k => k + 1)
    }, 6000)
    return () => clearInterval(timerRef.current)
  }, [messages.length])

  // Trivia facts rotation
  useEffect(() => {
    factTimerRef.current = setInterval(() => {
      setFactIndex(i => (i + 1) % FACTS.length)
    }, 12000)
    return () => clearInterval(factTimerRef.current)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (squishTimeoutRef.current) clearTimeout(squishTimeoutRef.current)
      if (comboResetTimeoutRef.current) clearTimeout(comboResetTimeoutRef.current)
      if (hyperTimeoutRef.current) clearTimeout(hyperTimeoutRef.current)
    }
  }, [])

  // Handle interactive clicks on Aguila
  const handleMascotInteract = useCallback(() => {
    // Retrigger squish animation
    setIsSquishing(false)
    if (squishTimeoutRef.current) clearTimeout(squishTimeoutRef.current)
    // Small timeout to allow re-render of animation class
    setTimeout(() => {
      setIsSquishing(true)
      squishTimeoutRef.current = setTimeout(() => setIsSquishing(false), 320)
    }, 10)

    // Spawn floating particle
    const newParticleId = Date.now() + Math.random()
    const randomEmoji = PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)]
    const randomTx = Math.floor(Math.random() * 40) - 20 // -20px to +20px

    setParticles(prev => [
      ...prev.slice(-6), // Keep max 7 particles
      { id: newParticleId, emoji: randomEmoji, tx: `${randomTx}px` }
    ])

    // Cleanup particle after 850ms
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newParticleId))
    }, 850)

    // Combo streak calculation
    setClickCount(c => {
      const nextCount = c + 1
      if (comboResetTimeoutRef.current) clearTimeout(comboResetTimeoutRef.current)
      comboResetTimeoutRef.current = setTimeout(() => setClickCount(0), 3000)

      if (nextCount >= 5) {
        setIsHyperCelebration(true)
        setInteractiveQuote("🌟 ULTRA FOCUS COMBO! Aguila is cheering you on!")
        setBubbleKey(k => k + 1)
        if (hyperTimeoutRef.current) clearTimeout(hyperTimeoutRef.current)
        hyperTimeoutRef.current = setTimeout(() => {
          setIsHyperCelebration(false)
          setInteractiveQuote(null)
          setClickCount(0)
        }, 4000)
      } else {
        const quote = INTERACTION_QUOTES[Math.floor(Math.random() * INTERACTION_QUOTES.length)]
        setInteractiveQuote(quote)
        setBubbleKey(k => k + 1)
      }

      return nextCount
    })
  }, [])

  // Cycle bubble manually on bubble click
  const handleBubbleClick = () => {
    setMsgIndex(i => (i + 1) % messages.length)
    setInteractiveQuote(null)
    setBubbleKey(k => k + 1)
  }

  const displayMsg = interactiveQuote || customMessage || messages[msgIndex]
  const isCelebrating = currentMood === 'celebrating'
  const isThinking = currentMood === 'thinking'
  const isTimer = currentMood === 'timer'
  const isStudying = currentMood === 'studying'

  // Pick the right motion class
  let motionClass = 'animate-aguila-bob'
  if (isCelebrating) {
    motionClass = 'animate-aguila-celebrate'
  } else if (isStudying || isThinking) {
    motionClass = 'animate-aguila-studying'
  }

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Speech bubble */}
      {showBubble && (
        <div 
          key={bubbleKey}
          onClick={handleBubbleClick}
          title="Click to cycle study wisdom"
          className="relative mb-3 max-w-[250px] cursor-pointer group animate-aguila-bubble focus:outline-none"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBubbleClick() } }}
        >
          <div className="bg-neutral-900/95 border border-neutral-700/80 group-hover:border-amber-500/50 px-3.5 py-2 rounded-xl shadow-xl shadow-black/40 text-center backdrop-blur-md transition-colors duration-200">
            <p className="text-xs font-medium text-neutral-200 leading-snug">
              {displayMsg}
            </p>
            {isThinking && (
              <span className="inline-flex gap-1 items-center justify-center mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </span>
            )}
            <span className="block text-[9px] text-neutral-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
              click for next tip ↻
            </span>
          </div>
          {/* Speech bubble pointer */}
          <div className="w-2.5 h-2.5 bg-neutral-900/95 border-r border-b border-neutral-700/80 group-hover:border-amber-500/50 transform rotate-45 mx-auto -mt-1.5 transition-colors duration-200" />
        </div>
      )}

      {/* Floating Interactive Particles */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-20">
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute text-xs font-bold text-amber-300 font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-aguila-particle px-1.5 py-0.5 rounded-full bg-neutral-900/80 border border-amber-500/30"
            style={{ '--p-tx': p.tx }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* Mascot Graphic container with interactive click, idle bobbing, and drop shadow */}
      <div 
        className="relative flex flex-col items-center justify-center cursor-pointer group aguila-clickable focus:outline-none"
        onClick={handleMascotInteract}
        role="button"
        tabIndex={0}
        aria-label="Interact with Aguila mascot - click to pat or motivate"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleMascotInteract()
          }
        }}
        style={{ animationDelay }}
      >
        {/* Animated mascot sprite */}
        <div 
          className={`relative z-10 transition-transform ${motionClass} ${
            isSquishing ? 'animate-aguila-squash' : ''
          }`}
        >
          <Image
            src={mascotSrc}
            alt={`Aguila mascot - ${currentMood}`}
            width={sizeConfig.width}
            height={sizeConfig.width}
            className="aguila-sprite object-contain drop-shadow-md select-none pointer-events-none transition-filter duration-200"
            style={{
              imageRendering: 'pixelated',
              width: `${sizeConfig.width}px`,
              height: `${sizeConfig.width}px`,
            }}
            priority
            unoptimized
          />

          {/* Status badge when timer is active */}
          {isTimer && (
            <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-neutral-950" />
            </span>
          )}

          {/* Combo badge when interacting quickly */}
          {clickCount > 1 && !isHyperCelebration && (
            <span className="absolute -top-1 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-neutral-950 font-mono shadow-md animate-bounce">
              x{clickCount}
            </span>
          )}
        </div>

        {/* Ambient Ground Shadow that expands and contracts with breathing float */}
        <div 
          className={`${sizeConfig.shadow} h-3 bg-black/45 rounded-[50%] blur-[2px] mt-[-6px] animate-aguila-shadow transition-all`}
        />
      </div>

      {/* Trivia facts under idle mascot */}
      {mood === 'idle' && (
        <p className="text-[11px] text-neutral-500 italic text-center max-w-[220px] leading-relaxed mt-2.5">
          &ldquo;{FACTS[factIndex]}&rdquo;
        </p>
      )}
    </div>
  )
}
