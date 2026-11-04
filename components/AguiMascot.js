'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from '@/components/Icons'

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
  xs: { width: 48, shadow: 'w-10' },
  sm: { width: 84, shadow: 'w-16' },
  md: { width: 120, shadow: 'w-24' },
  lg: { width: 160, shadow: 'w-32' },
  xl: { width: 196, shadow: 'w-40' },
}

const RETRO_SPARKS = [
  '+15 EXP',
  'FOCUS +1',
  'STREAK x3',
  'CRITICAL RECALL',
  'LEVEL UP!',
  'AURA 100%',
  'MASTERY +1',
]

const ACCESSORIES = [
  { id: 'none', label: 'Natural', iconType: 'feather' },
  { id: 'glasses', label: 'Scholar', iconType: 'glasses' },
  { id: 'cap', label: 'Graduate', iconType: 'cap' },
  { id: 'headphones', label: 'Lo-Fi', iconType: 'headphones' },
  { id: 'crown', label: 'Honor', iconType: 'crown' },
  { id: 'headband', label: 'Focus', iconType: 'bolt' },
]

// ── Native 8-Bit Web Audio Synthesizer (Zero External Dependencies) ─────────
function play8BitAudio(type = 'chirp') {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const now = ctx.currentTime

    if (type === 'chirp') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(680, now)
      osc.frequency.exponentialRampToValueAtTime(1350, now + 0.07)
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.13)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'purr') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.linearRampToValueAtTime(560, now + 0.05)
      osc.frequency.linearRampToValueAtTime(500, now + 0.1)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.12)
    } else if (type === 'xp') {
      const notes = [523.25, 659.25, 783.99, 1046.50]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.05)
        gain.gain.setValueAtTime(0.05, now + idx * 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.07)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.05)
        osc.stop(now + idx * 0.05 + 0.08)
      })
    }
  } catch (e) {
    // Audio context not allowed or not ready yet
  }
}

export default function AguiMascot({
  mood = 'idle',
  size = 'lg',
  showBubble = true,
  customMessage = '',
  guidanceText = '',
  guidanceBadge = '',
  onQuickPrompt = null,
  animationDelay = '0s',
  isTyping = false,
  isInputFocused = false,
  interactive = true,
}) {
  const [guideIndex, setGuideIndex] = useState(0)
  const [isSquashing, setIsSquashing] = useState(false)
  const [isHappy, setIsHappy] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)
  const [particles, setParticles] = useState([])
  const [hearts, setHearts] = useState([])
  const [bubbleKey, setBubbleKey] = useState(0)
  const [interactiveMsg, setInteractiveMsg] = useState(null)
  const [accessory, setAccessory] = useState('none')
  const [soundEnabled, setSoundEnabled] = useState(false)

  // Mouse & gaze tracking states
  const [gaze, setGaze] = useState({ tiltX: 0, tiltY: 0, pupilX: 0, pupilY: 0 })
  // Mascot Engine conversational mouth / beak dynamics
  const [mouthOpen, setMouthOpen] = useState(0)

  const mascotRef = useRef(null)
  const timerRef = useRef(null)
  const squashTimeoutRef = useRef(null)
  const happyTimeoutRef = useRef(null)
  const petCounterRef = useRef({ count: 0, lastTime: 0 })
  const rafRef = useRef(null)

  const messages = MOOD_MESSAGES[mood] || MOOD_MESSAGES.idle
  const mascotSrc = MASCOT_IMAGES[mood] || MASCOT_IMAGES.idle
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.lg

  // Load persisted accessory & sound preference
  useEffect(() => {
    try {
      const savedAcc = localStorage.getItem('aguila_accessory')
      if (savedAcc && ACCESSORIES.some(a => a.id === savedAcc)) {
        setAccessory(savedAcc)
      }
      const savedSound = localStorage.getItem('aguila_sound')
      if (savedSound === 'true') {
        setSoundEnabled(true)
      }
    } catch (e) {}
  }, [])

  // Rotate guidance steps smoothly every 8 seconds when idle
  useEffect(() => {
    if (customMessage || guidanceText) return

    timerRef.current = setInterval(() => {
      setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
      setInteractiveMsg(null)
      setBubbleKey(k => k + 1)
    }, 8500)

    return () => clearInterval(timerRef.current)
  }, [customMessage, guidanceText])

  // ── Natural Blinking Engine (Organic intervals + realistic double blinks) ──
  useEffect(() => {
    let blinkTimeout
    let closeTimeout

    const scheduleBlink = () => {
      const delay = 3200 + Math.random() * 2800 // 3.2s - 6s
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true)
        closeTimeout = setTimeout(() => {
          setIsBlinking(false)
          // 25% chance of realistic double-blink
          if (Math.random() < 0.25) {
            setTimeout(() => {
              setIsBlinking(true)
              setTimeout(() => {
                setIsBlinking(false)
                scheduleBlink()
              }, 110)
            }, 140)
          } else {
            scheduleBlink()
          }
        }, 130)
      }, delay)
    }

    scheduleBlink()

    return () => {
      clearTimeout(blinkTimeout)
      clearTimeout(closeTimeout)
    }
  }, [])

  // ── Interactive Cursor & Gaze Tracking (Tarsi-style alive tracking) ──────
  useEffect(() => {
    if (!interactive) return

    const handleMouseMove = (e) => {
      if (!mascotRef.current) return

      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
        const rect = mascotRef.current?.getBoundingClientRect()
        if (!rect) return

        const mascotCenterX = rect.left + rect.width / 2
        const mascotCenterY = rect.top + rect.height * 0.45

        const dx = (e.clientX - mascotCenterX) / (window.innerWidth / 2)
        const dy = (e.clientY - mascotCenterY) / (window.innerHeight / 2)

        // Clamped realistic raptor eye and head tilt angles
        let targetTiltY = Math.max(-12, Math.min(12, dx * 12))
        let targetTiltX = Math.max(-9, Math.min(9, -dy * 9))
        let targetPupilX = Math.max(-2.2, Math.min(2.2, dx * 2.2))
        let targetPupilY = Math.max(-1.8, Math.min(1.8, dy * 1.8))

        // Focus bias if student is typing or AI is generating
        if (isInputFocused) {
          targetTiltX = -5 // Leans head down to look at keyboard/chat input
          targetPupilY = 1.9 // Eyes cast down at input bar
        } else if (isTyping) {
          targetTiltX = 6 // Head tilted back thoughtfully
          targetTiltY = 4
          targetPupilY = -1.8 // Glancing up into thought
          targetPupilX = 1.2
        }

        setGaze({
          tiltX: Number(targetTiltX.toFixed(2)),
          tiltY: Number(targetTiltY.toFixed(2)),
          pupilX: Number(targetPupilX.toFixed(2)),
          pupilY: Number(targetPupilY.toFixed(2)),
        })
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [interactive, isInputFocused, isTyping])

  // ── Mascot Engine Conversational Lip-Sync (Dynamic Beak Flap when AI replies) ──
  useEffect(() => {
    if (!isTyping) {
      setMouthOpen(0)
      return
    }

    let flapTimer
    const animateMouth = () => {
      const openVal = Math.random() > 0.35 ? Number((0.35 + Math.random() * 0.65).toFixed(2)) : 0
      setMouthOpen(openVal)
      flapTimer = setTimeout(animateMouth, 85 + Math.random() * 95)
    }

    animateMouth()
    return () => clearTimeout(flapTimer)
  }, [isTyping])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (squashTimeoutRef.current) clearTimeout(squashTimeoutRef.current)
      if (happyTimeoutRef.current) clearTimeout(happyTimeoutRef.current)
    }
  }, [])

  // ── Thoughtful Retro Tap / Poke Micro-Interaction ────────────────────────
  const handleMascotInteract = useCallback(() => {
    setIsSquashing(false)
    if (squashTimeoutRef.current) clearTimeout(squashTimeoutRef.current)

    // Trigger elastic squash-and-stretch
    setTimeout(() => {
      setIsSquashing(true)
      squashTimeoutRef.current = setTimeout(() => setIsSquashing(false), 420)
    }, 10)

    if (soundEnabled) {
      play8BitAudio('chirp')
    }

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
    setInteractiveMsg("I'm tracking your progress! Ask me anything or click a study hook below.")
    setBubbleKey(k => k + 1)
  }, [soundEnabled])

  // ── Petting Micro-Interaction (Stroking or rapid hover passes) ────────────
  const handleMascotHoverStroke = useCallback(() => {
    const now = Date.now()
    const tracker = petCounterRef.current

    if (now - tracker.lastTime < 450) {
      tracker.count += 1
    } else {
      tracker.count = 1
    }
    tracker.lastTime = now

    // After 3 quick strokes, Aguila enters happy purr mode!
    if (tracker.count >= 3) {
      tracker.count = 0
      setIsHappy(true)
      if (happyTimeoutRef.current) clearTimeout(happyTimeoutRef.current)
      happyTimeoutRef.current = setTimeout(() => setIsHappy(false), 1200)

      if (soundEnabled) {
        play8BitAudio('purr')
      }

      // Spawn floating hearts
      const heartId = Date.now() + Math.random()
      const tx = Math.floor(Math.random() * 28) - 14
      setHearts(prev => [...prev.slice(-3), { id: heartId, tx: `${tx}px` }])
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== heartId))
      }, 900)
    }
  }, [soundEnabled])

  const handleBubbleCycle = () => {
    setGuideIndex(i => (i + 1) % GUIDANCE_STEPS.length)
    setInteractiveMsg(null)
    setBubbleKey(k => k + 1)
  }

  const cycleAccessory = () => {
    const currentIdx = ACCESSORIES.findIndex(a => a.id === accessory)
    const nextIdx = (currentIdx + 1) % ACCESSORIES.length
    const nextAcc = ACCESSORIES[nextIdx].id
    setAccessory(nextAcc)
    try {
      localStorage.setItem('aguila_accessory', nextAcc)
    } catch (e) {}
    if (soundEnabled) play8BitAudio('xp')
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    try {
      localStorage.setItem('aguila_sound', String(next))
    } catch (e) {}
    if (next) play8BitAudio('chirp')
  }

  const activeGuide = GUIDANCE_STEPS[guideIndex]
  const currentBadge = guidanceBadge || (guidanceText ? 'Action Guide' : (interactiveMsg ? 'Agui Study Tip' : (customMessage ? 'Status' : activeGuide.badge)))
  const displayMsg = guidanceText || interactiveMsg || customMessage || (mood === 'idle' ? activeGuide.text : messages[0])

  const isThinkingMood = mood === 'thinking' || isTyping
  const isStudyingMood = mood === 'studying'
  const isCelebratingMood = mood === 'celebrating'
  const isTimerMood = mood === 'timer'

  // Eye happiness: active celebration, petting, or happy trigger
  const showHappyEyes = isHappy || isCelebratingMood

  return (
    <div 
      ref={mascotRef}
      className="flex flex-col items-center select-none relative max-w-sm mx-auto"
    >
      {/* ── Retro 16-Bit RPG Dialogue Box / Study Guide ── */}
      {showBubble && (
        <div 
          key={bubbleKey}
          onClick={handleBubbleCycle}
          title="Click to cycle study guide"
          className="relative mb-3 max-w-[300px] sm:max-w-[340px] cursor-pointer group animate-aguila-bubble focus:outline-none z-20"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBubbleCycle() } }}
        >
          {/* Retro RPG Dialogue Panel */}
          <div className="bg-neutral-900/95 border-2 border-neutral-700/80 group-hover:border-amber-400/80 px-4 py-2.5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200">
            {/* Retro Badge Header & Interactive Controls */}
            <div className="flex items-center justify-between gap-1.5 mb-1 pb-1 border-b border-neutral-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-400 inline-block shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                  {currentBadge}
                </span>
              </div>

              {/* Quick Outfit & Audio Controls */}
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={cycleAccessory}
                  className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 hover:text-amber-300 transition-colors border border-neutral-700 flex items-center gap-1"
                  title="Cycle retro RPG outfit (Glasses, Cap, Headphones, Crown, Headband)"
                >
                  {Icon[ACCESSORIES.find(a => a.id === accessory)?.iconType || 'feather']?.('w-3 h-3 text-amber-400')}
                  <span className="hidden sm:inline text-[9px] uppercase">Outfit</span>
                </button>

                <button
                  type="button"
                  onClick={toggleSound}
                  className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-mono text-neutral-300 hover:text-amber-300 transition-colors border border-neutral-700"
                  title={soundEnabled ? '8-Bit audio enabled (click to mute)' : 'Muted (click to enable 8-bit sounds)'}
                >
                  {soundEnabled ? Icon.volume('w-3 h-3 text-amber-400') : Icon.volumeX('w-3 h-3 text-neutral-400')}
                </button>

                <span className="text-[9px] text-neutral-500 font-mono ml-0.5 flex items-center gap-1">
                  <span>LVL 5</span>
                  {Icon.eagle('w-2.5 h-2.5 text-amber-400/80')}
                </span>
              </div>
            </div>

            <p className="text-xs font-medium text-neutral-200 leading-relaxed font-sans">
              {displayMsg}
            </p>

            {isThinkingMood && (
              <div className="flex items-center gap-2 mt-2 pt-1 border-t border-neutral-800/80">
                <span className="w-1.5 h-1.5 bg-amber-400 animate-ping inline-block" />
                <span className="text-[10px] font-mono text-amber-400 font-semibold tracking-wider">
                  AGUI IS THINKING...
                </span>
              </div>
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

        {hearts.map(h => (
          <span
            key={h.id}
            className="absolute animate-aguila-heart drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{ '--h-tx': h.tx }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-rose-500">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </span>
        ))}
      </div>

      {/* ── Living Interactive Mascot Container (Tracks cursor in 3D perspective) ── */}
      <div 
        className="relative flex flex-col items-center justify-center cursor-pointer aguila-clickable focus:outline-none"
        onClick={handleMascotInteract}
        onMouseMove={handleMascotHoverStroke}
        role="button"
        tabIndex={0}
        aria-label="Agui the interactive retro study guide mascot - click or pet for reaction"
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

        {/* ── 3D Head & Body Tracking Wrapper ────────────────────────────── */}
        <div 
          className={`relative z-10 transition-transform duration-100 ease-out ${
            isStudyingMood || isThinkingMood ? 'animate-aguila-studying' : 'animate-aguila-alive'
          } ${isSquashing ? 'animate-aguila-squash' : ''}`}
          style={{
            transform: `perspective(600px) rotateX(${gaze.tiltX}deg) rotateY(${gaze.tiltY}deg) rotateZ(${gaze.tiltY * 0.16}deg)`,
            transformOrigin: '50% 85%',
          }}
        >
          {/* Base Pixel Art Philippine Eagle Sprite */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mascotSrc}
            alt={`Aguila mascot - ${mood}`}
            width={sizeConfig.width}
            height={sizeConfig.width}
            className="aguila-sprite object-contain select-none pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-all duration-150"
            style={{
              imageRendering: 'pixelated',
              width: `${sizeConfig.width}px`,
              height: `${sizeConfig.width}px`,
            }}
          />

          {/* ── Dynamic Living Eyes & Gaze Overlay (SVG layer) ───────────── */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none select-none z-20"
            viewBox="0 0 100 100"
            style={{ imageRendering: 'pixelated' }}
            aria-hidden="true"
          >
            {/* ── Mascot Engine Secondary Physics Crest Feather Lag ─────── */}
            <g transform={`translate(${49 - gaze.tiltY * 0.35}, ${16 - gaze.tiltX * 0.25})`}>
              <path
                d="M -6 8 Q -10 2 -6 -5 Q -3 4 -1 7 Q 0 -8 3 -5 Q 2 3 5 6 Q 9 0 10 5 Q 5 8 0 8 Z"
                fill="#78350F"
                opacity="0.9"
                style={{
                  transform: `rotate(${-gaze.tiltY * 0.6}deg)`,
                  transformOrigin: '0% 100%',
                  transition: 'transform 0.12s ease-out'
                }}
              />
            </g>

            {/* Left Eye & Pupil */}
            <g transform="translate(37, 41)">
              {showHappyEyes ? (
                // Happy curved squint eye (⌒)
                <path
                  d="M -3 1 Q 0 -3 3 1"
                  stroke="#F59E0B"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  {/* Dynamic pupil tracking cursor */}
                  <rect
                    x={-1.5 + gaze.pupilX}
                    y={-1.5 + gaze.pupilY}
                    width="3"
                    height="3"
                    fill="#0F172A"
                  />
                  {/* Specular Glint */}
                  <rect
                    x={-0.5 + gaze.pupilX * 0.4}
                    y={-1.5 + gaze.pupilY * 0.4}
                    width="1.2"
                    height="1.2"
                    fill="#FFFFFF"
                  />
                  {/* Dynamic Eyelid Blinking */}
                  {isBlinking && (
                    <rect
                      x="-4"
                      y="-3.5"
                      width="8"
                      height="7"
                      fill="#78350F"
                    />
                  )}
                </>
              )}
            </g>

            {/* Right Eye & Pupil */}
            <g transform="translate(61, 41)">
              {showHappyEyes ? (
                // Happy curved squint eye (⌒)
                <path
                  d="M -3 1 Q 0 -3 3 1"
                  stroke="#F59E0B"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  {/* Dynamic pupil tracking cursor */}
                  <rect
                    x={-1.5 + gaze.pupilX}
                    y={-1.5 + gaze.pupilY}
                    width="3"
                    height="3"
                    fill="#0F172A"
                  />
                  {/* Specular Glint */}
                  <rect
                    x={-0.5 + gaze.pupilX * 0.4}
                    y={-1.5 + gaze.pupilY * 0.4}
                    width="1.2"
                    height="1.2"
                    fill="#FFFFFF"
                  />
                  {/* Dynamic Eyelid Blinking */}
                  {isBlinking && (
                    <rect
                      x="-4"
                      y="-3.5"
                      width="8"
                      height="7"
                      fill="#78350F"
                    />
                  )}
                </>
              )}
            </g>

            {/* ── Mascot Engine Conversational Animated Beak Overlay ──────── */}
            {isTyping && (
              <g transform={`translate(49, ${48 + mouthOpen * 1.6})`}>
                {mouthOpen > 0.2 && (
                  <ellipse cx="0" cy="1" rx="2.5" ry={mouthOpen * 1.5} fill="#451a03" />
                )}
                {/* Hooked raptor lower beak */}
                <path
                  d={`M -3.5 0 Q 0 ${1.8 + mouthOpen * 2.2} 3.5 0 Z`}
                  fill="#F59E0B"
                  stroke="#78350F"
                  strokeWidth="0.8"
                />
              </g>
            )}

            {/* ── Retro RPG Accessories Layer ───────────────────────────── */}
            {/* 1. Scholar Glasses */}
            {accessory === 'glasses' && (
              <g id="retro-glasses" transform="translate(0, -1)">
                {/* Left wireframe frame */}
                <rect x="33" y="37" width="9" height="9" fill="none" stroke="#FBBF24" strokeWidth="1.5" />
                <rect x="34" y="38" width="7" height="7" fill="#38BDF8" fillOpacity="0.15" />
                {/* Right wireframe frame */}
                <rect x="56" y="37" width="9" height="9" fill="none" stroke="#FBBF24" strokeWidth="1.5" />
                <rect x="57" y="38" width="7" height="7" fill="#38BDF8" fillOpacity="0.15" />
                {/* Bridge */}
                <line x1="42" y1="41" x2="56" y2="41" stroke="#FBBF24" strokeWidth="1.5" />
                {/* Glint line */}
                <line x1="35" y1="39" x2="39" y2="43" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.8" />
              </g>
            )}

            {/* 2. Graduation Mortarboard */}
            {accessory === 'cap' && (
              <g id="retro-mortarboard" transform="translate(0, -4)">
                {/* Cap diamond */}
                <polygon points="49,12 76,20 49,28 22,20" fill="#18181B" stroke="#27272A" strokeWidth="1" />
                {/* Cap skull cap */}
                <rect x="38" y="24" width="22" height="7" fill="#09090B" rx="1" />
                {/* Gold tassel button */}
                <circle cx="49" cy="20" r="1.5" fill="#F59E0B" />
                {/* Swinging tassel ribbon */}
                <path d="M 49 20 Q 38 22 36 29" stroke="#F59E0B" strokeWidth="1.2" fill="none" />
                <rect x="34.5" y="29" width="3" height="4" fill="#D97706" />
              </g>
            )}

            {/* 3. Lo-Fi Study Headphones */}
            {accessory === 'headphones' && (
              <g id="retro-headphones" transform="translate(0, 2)">
                {/* Headband arch */}
                <path d="M 28 42 C 28 18, 70 18, 70 42" fill="none" stroke="#71717A" strokeWidth="2.2" strokeLinecap="round" />
                {/* Left orange foam earcup */}
                <rect x="24" y="38" width="6" height="12" rx="2" fill="#F97316" stroke="#C2410C" strokeWidth="1" />
                {/* Right orange foam earcup */}
                <rect x="68" y="38" width="6" height="12" rx="2" fill="#F97316" stroke="#C2410C" strokeWidth="1" />
              </g>
            )}

            {/* 4. Honor Student Crown */}
            {accessory === 'crown' && (
              <g id="retro-crown" transform="translate(0, -5)">
                {/* Golden crown peaks */}
                <polygon points="34,22 36,12 43,18 49,10 55,18 62,12 64,22" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
                {/* Crown base */}
                <rect x="34" y="22" width="30" height="4" fill="#D97706" />
                {/* Ruby & Sapphire Jewels */}
                <circle cx="41" cy="24" r="1.2" fill="#EF4444" />
                <circle cx="49" cy="24" r="1.2" fill="#3B82F6" />
                <circle cx="57" cy="24" r="1.2" fill="#10B981" />
              </g>
            )}

            {/* 5. Focus Martial Arts Headband */}
            {accessory === 'headband' && (
              <g id="retro-headband" transform="translate(0, 1)">
                {/* Red band across crest */}
                <rect x="30" y="31" width="38" height="4.5" fill="#DC2626" rx="1" />
                {/* White sun crest badge */}
                <circle cx="49" cy="33.2" r="1.8" fill="#FFFFFF" />
                {/* Fluttering tie ribbons */}
                <path d="M 67 33 Q 73 35 77 40" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
                <path d="M 68 34 Q 75 39 76 44" fill="none" stroke="#B91C1C" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            )}
          </svg>

          {/* ── Active Status Overlays ─────────────────────────────────── */}
          {/* Thinking / Synthesizing Gear */}
          {isThinkingMood && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
              {Icon.gear('w-4 h-4 text-amber-400 animate-aguila-gear drop-shadow-[0_2px_6px_rgba(251,191,36,0.8)]')}
            </div>
          )}

          {/* Timer Focus Mode Equalizer */}
          {isTimerMood && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-1 pointer-events-none px-2 py-0.5 rounded bg-neutral-950/80 border border-amber-500/30">
              <span className="w-1 bg-amber-400 rounded-full inline-block animate-pulse" style={{ height: '8px' }} />
              <span className="w-1 bg-amber-300 rounded-full inline-block animate-pulse" style={{ height: '14px', animationDelay: '0.15s' }} />
              <span className="w-1 bg-amber-500 rounded-full inline-block animate-pulse" style={{ height: '10px', animationDelay: '0.3s' }} />
            </div>
          )}

          {/* Celebrating Trophy Badge */}
          {isCelebratingMood && (
            <span className="absolute -top-3 -right-3 px-1.5 py-0.5 rounded bg-emerald-500 text-neutral-950 font-mono text-[10px] font-bold border border-emerald-400 shadow-[2px_2px_0px_rgba(0,0,0,0.8)] animate-bounce flex items-center gap-1">
              <span>A+</span>
              {Icon.trophy('w-3 h-3 text-neutral-950')}
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

// ── In-Chat Persistent Mini Companion (Tarsi companion for live study) ──────
export function AguiInChatCompanion({
  isTyping = false,
  messageCount = 0,
  onTipClick = null,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [speech, setSpeech] = useState('')
  const [showSpeech, setShowSpeech] = useState(false)

  const handlePoke = () => {
    play8BitAudio('chirp')
    const tips = [
      "Keep the momentum going! Active recall builds real synaptic strength.",
      "Stuck? Click 'ELI5' under any explanation for an intuitive analogy.",
      "Test yourself before the exam: try the 'Flashcard Drill' in the tool bar!",
      "I'm keeping track of key concepts from your uploaded notes.",
    ]
    const chosen = tips[Math.floor(Math.random() * tips.length)]
    setSpeech(chosen)
    setShowSpeech(true)
    setTimeout(() => setShowSpeech(false), 5500)
    if (onTipClick) onTipClick(chosen)
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Speech popover when poked */}
      {showSpeech && (
        <div className="absolute right-0 bottom-full mb-2 w-64 p-2.5 bg-neutral-900 border-2 border-amber-400/80 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.9)] z-50 animate-aguila-bubble">
          <div className="flex items-center gap-1.5 mb-1 pb-0.5 border-b border-neutral-800 text-[10px] font-mono text-amber-400 font-bold">
            {Icon.eagle('w-3 h-3 text-amber-400')}
            <span>AGUI STUDY TIP</span>
          </div>
          <p className="text-xs text-neutral-200 font-sans leading-snug">
            {speech}
          </p>
        </div>
      )}

      {/* Mini Companion Perch Button */}
      <button
        type="button"
        onClick={handlePoke}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400/50 transition-all shadow-sm group"
        title="Agui is studying with you. Click for a quick study tip!"
      >
        <div className="relative w-6 h-6 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isTyping ? '/mascot-studying.png' : '/mascot-idle.png'}
            alt="Agui companion"
            className={`w-6 h-6 object-contain select-none transition-transform ${
              isTyping ? 'animate-aguila-studying' : 'animate-aguila-alive'
            } group-hover:scale-110`}
            style={{ imageRendering: 'pixelated' }}
          />
          {isTyping && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </div>

        <div className="text-left hidden sm:block">
          <p className="text-[10px] font-mono font-bold text-amber-400 leading-tight">
            AGUI {isTyping ? 'ANALYZING' : 'READY'}
          </p>
          <p className="text-[9px] text-neutral-500 font-mono leading-tight">
            {messageCount} turn{messageCount !== 1 ? 's' : ''} • tap tip
          </p>
        </div>
      </button>
    </div>
  )
}
