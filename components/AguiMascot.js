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

const SIZE_MAP = {
  sm: { width: 80, height: 104, aura: 'w-24 h-24' },
  md: { width: 110, height: 144, aura: 'w-32 h-32' },
  lg: { width: 150, height: 196, aura: 'w-44 h-44' },
  xl: { width: 185, height: 240, aura: 'w-52 h-52' },
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
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md

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

  // Thoughtful nod on interaction (zero cartoon bounce)
  const handleMascotInteract = useCallback(() => {
    setIsNodding(false)
    if (nodTimeoutRef.current) clearTimeout(nodTimeoutRef.current)

    setTimeout(() => {
      setIsNodding(true)
      nodTimeoutRef.current = setTimeout(() => setIsNodding(false), 360)
    }, 10)

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

      {/* Floating Guidance Sparks */}
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

      {/* ── Authentically Animated Vector Aguila (Zero Background Box, Living Motion, Zero Bouncing) ── */}
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
        {/* Soft Ambient Backlight */}
        <div 
          className={`absolute ${sizeConfig.aura} rounded-full bg-radial from-amber-500/10 via-amber-500/5 to-transparent blur-xl pointer-events-none animate-aguila-aura`}
          style={{ top: '10%' }}
        />

        {/* Articulated SVG Aguila Matching Public Character Design */}
        <svg
          viewBox="0 0 120 156"
          width={sizeConfig.width}
          height={sizeConfig.height}
          className={`relative z-10 transition-transform ${
            isStudying || isThinking ? 'animate-aguila-studying' : 'animate-aguila-alive'
          } ${isNodding ? 'animate-aguila-nod' : ''}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Tree stump top ring gradient */}
            <radialGradient id="stumpTop" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C99863" />
              <stop offset="70%" stopColor="#AD7B47" />
              <stop offset="100%" stopColor="#784E26" />
            </radialGradient>
            {/* Eagle plumage shading */}
            <linearGradient id="bodyShade" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8C6239" />
              <stop offset="100%" stopColor="#5E3C1B" />
            </linearGradient>
            {/* Breast feather gradient */}
            <linearGradient id="breastGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5E8C9" />
              <stop offset="100%" stopColor="#DFCEAA" />
            </linearGradient>
            {/* Beak gradient */}
            <linearGradient id="beakHook" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="45%" stopColor="#D97706" />
              <stop offset="85%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>

          {/* ── 1. Rustic Wooden Perch Stump (Natural ground contact) ── */}
          <g id="stump">
            {/* Log bark base */}
            <path
              d="M32 138 Q28 152 30 156 L90 156 Q92 152 88 138 Z"
              fill="#5A3A1C"
              stroke="#3D2513"
              strokeWidth="1.5"
            />
            {/* Bark texture ridges */}
            <line x1="45" y1="140" x2="43" y2="155" stroke="#3D2513" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="60" y1="141" x2="61" y2="155" stroke="#3D2513" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="75" y1="140" x2="77" y2="155" stroke="#3D2513" strokeWidth="1.2" strokeLinecap="round" />
            {/* Log top oval surface */}
            <ellipse cx="60" cy="138" rx="28" ry="7" fill="url(#stumpTop)" stroke="#5A3A1C" strokeWidth="1.5" />
            {/* Inner growth ring */}
            <ellipse cx="60" cy="138" rx="18" ry="4" fill="none" stroke="#8A5C2D" strokeWidth="0.8" opacity="0.6" />
            <ellipse cx="60" cy="138" rx="9" ry="2" fill="none" stroke="#66411C" strokeWidth="0.8" opacity="0.5" />
          </g>

          {/* ── 2. Tail Feathers (Subtle tail sway) ── */}
          <g
            id="tail"
            style={{
              transformBox: 'fill-box',
              transformOrigin: '50% 10%',
              animation: 'aguila-tail 4s ease-in-out infinite',
            }}
          >
            <path d="M28 110 L20 134 L28 131 L34 133 L38 116 Z" fill="#4A2F16" stroke="#2B1A0C" strokeWidth="1" />
            <path d="M24 116 L16 136 L24 133 Z" fill="#3D2513" />
          </g>

          {/* ── 3. Talons / Claws (Gripping the log) ── */}
          <g id="talons">
            {/* Left foot */}
            <path d="M42 124 L40 138 M37 139 L47 139 M42 138 L43 143 M47 137 L51 140" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <path d="M37 139 L35 141 M43 143 L43 145 M51 140 L53 142" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
            {/* Right foot */}
            <path d="M68 124 L69 138 M64 139 L74 139 M69 138 L70 143 M74 137 L78 140" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <path d="M64 139 L62 141 M70 143 L70 145 M78 140 L80 142" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* ── 4. Main Body & Plumage ── */}
          <g id="body">
            {/* Back body mass */}
            <ellipse cx="55" cy="98" rx="26" ry="28" fill="url(#bodyShade)" stroke="#2B1A0C" strokeWidth="1.5" />
            
            {/* Cream breast feathers with dappled Philippine eagle texture */}
            <path
              d="M42 82 Q34 100 42 120 Q55 125 68 120 Q76 100 68 82 Q55 76 42 82 Z"
              fill="url(#breastGrad)"
              stroke="#BFA375"
              strokeWidth="0.8"
            />
            {/* Dappled breast markings */}
            <ellipse cx="48" cy="92" rx="2" ry="1.2" fill="#8C6239" opacity="0.6" />
            <ellipse cx="58" cy="94" rx="2.5" ry="1.2" fill="#8C6239" opacity="0.7" />
            <ellipse cx="52" cy="102" rx="2" ry="1.4" fill="#8C6239" opacity="0.6" />
            <ellipse cx="62" cy="106" rx="2.2" ry="1.2" fill="#8C6239" opacity="0.5" />
            <ellipse cx="46" cy="110" rx="1.8" ry="1" fill="#8C6239" opacity="0.6" />
            <ellipse cx="54" cy="114" rx="2.2" ry="1.2" fill="#8C6239" opacity="0.6" />
          </g>

          {/* ── 5. Left Wing (Resting flank wing) ── */}
          <g id="left-wing">
            <path
              d="M32 78 Q20 95 24 122 Q34 124 38 106 Q40 88 32 78 Z"
              fill="#52361B"
              stroke="#2B1A0C"
              strokeWidth="1.2"
            />
            {/* Wing feather layers */}
            <path d="M28 92 Q22 108 26 120" stroke="#3D2513" strokeWidth="1" fill="none" />
            <path d="M33 96 Q29 110 32 118" stroke="#3D2513" strokeWidth="1" fill="none" />
          </g>

          {/* ── 6. Right Wing (Thumbs-up gesture from authentic reference) ── */}
          <g
            id="right-wing-thumb"
            style={{
              transformBox: 'fill-box',
              transformOrigin: '20% 50%',
              animation: 'aguila-wing-sway 3.8s ease-in-out infinite',
            }}
          >
            {isCelebrating ? (
              // Both wings raised celebrating
              <path
                d="M74 84 Q104 68 108 42 Q92 56 78 80 Z"
                fill="#6B4522"
                stroke="#2B1A0C"
                strokeWidth="1.5"
              />
            ) : isStudying ? (
              // Holding red study book
              <g>
                <path d="M72 86 Q86 88 94 98 Q80 106 70 94 Z" fill="#6B4522" stroke="#2B1A0C" strokeWidth="1.2" />
                {/* Red Book */}
                <rect x="74" y="90" width="18" height="24" rx="2" fill="#DC2626" stroke="#991B1B" strokeWidth="1" transform="rotate(-12 74 90)" />
                <rect x="76" y="92" width="14" height="20" rx="1" fill="#FEF3C7" transform="rotate(-12 74 90)" />
                <line x1="77" y1="96" x2="87" y2="94" stroke="#92400E" strokeWidth="1" />
                <line x1="78" y1="100" x2="88" y2="98" stroke="#92400E" strokeWidth="1" />
              </g>
            ) : (
              // Authentic Thumbs Up Wing (exact match to public/mascot-idle.png)
              <g>
                {/* Wing arm base */}
                <path
                  d="M70 85 Q88 84 94 95 Q86 108 68 102 Z"
                  fill="#6B4522"
                  stroke="#2B1A0C"
                  strokeWidth="1.2"
                />
                {/* Wing hand palm */}
                <ellipse cx="94" cy="94" rx="8" ry="7" fill="#8C6239" stroke="#3D2513" strokeWidth="1" />
                {/* Extended Eagle Thumb Up 👍 */}
                <rect
                  x="92"
                  y="74"
                  width="7"
                  height="16"
                  rx="3.5"
                  fill="#A27344"
                  stroke="#2B1A0C"
                  strokeWidth="1.2"
                  transform="rotate(6 92 74)"
                />
                {/* Thumb knuckle detail */}
                <line x1="93" y1="82" x2="98" y2="83" stroke="#5E3C1B" strokeWidth="0.8" />
                {/* Folded wing fingers */}
                <path d="M96 90 Q104 92 98 97 Q104 98 96 102" fill="none" stroke="#3D2513" strokeWidth="1.2" />
              </g>
            )}
          </g>

          {/* ── 7. Neck & Head Base ── */}
          <g id="head-group">
            {/* Neck transition */}
            <path d="M42 66 L68 66 L66 78 L44 78 Z" fill="#6B4522" />

            {/* Regal Crown / Crest Feathers (Philippine Eagle hallmark) */}
            <g
              id="crest"
              style={{
                transformBox: 'fill-box',
                transformOrigin: '50% 90%',
                animation: 'aguila-crest 3.8s ease-in-out infinite',
              }}
            >
              {/* Back crest spikes */}
              <polygon points="34,42 22,22 36,36" fill="#3D2513" stroke="#24150A" strokeWidth="0.8" />
              <polygon points="38,36 30,12 44,28" fill="#52361B" stroke="#24150A" strokeWidth="0.8" />
              <polygon points="46,30 42,4 52,24" fill="#7A4F26" stroke="#24150A" strokeWidth="0.8" />
              <polygon points="52,28 54,6 60,26" fill="#6B4522" stroke="#24150A" strokeWidth="0.8" />
              <polygon points="58,30 68,14 66,32" fill="#52361B" stroke="#24150A" strokeWidth="0.8" />
            </g>

            {/* Main Head Structure */}
            <ellipse cx="54" cy="50" rx="20" ry="19" fill="#7A4F26" stroke="#2B1A0C" strokeWidth="1.2" />

            {/* Warm Face Mask (tan feathered mask around eyes and cheeks) */}
            <path
              d="M44 42 Q60 38 68 46 Q74 58 66 64 Q50 66 42 58 Q38 48 44 42 Z"
              fill="#EFE3C3"
              stroke="#BFA375"
              strokeWidth="0.8"
            />

            {/* ── 8. Eye with Natural Blink Animation ── */}
            <g
              id="eye"
              style={{
                transformBox: 'fill-box',
                transformOrigin: '52px 48px',
                animation: 'aguila-blink 4.2s ease-in-out infinite',
              }}
            >
              {/* White sclera */}
              <ellipse cx="52" cy="48" rx="5.5" ry="5.5" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1" />
              {/* Deep obsidian eagle iris */}
              <circle cx="53" cy="48" r="3.8" fill="#18181B" />
              {/* Bright specular highlight */}
              <circle cx="54.5" cy="46.2" r="1.4" fill="#FFFFFF" />
              <circle cx="51.8" cy="49.5" r="0.7" fill="#FFFFFF" opacity="0.7" />
              {/* Keen eagle brow ridge */}
              <path d="M46 43 Q52 41 58 44" stroke="#3D2513" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </g>

            {/* ── 9. Scholar Glasses Overlay (when studying/thinking) ── */}
            {(isStudying || isThinking) && (
              <g id="scholar-glasses">
                <circle cx="52" cy="48" r="6.8" fill="rgba(59, 130, 246, 0.08)" stroke="#F59E0B" strokeWidth="1.4" />
                <path d="M58.8 48 Q64 46 68 48" stroke="#F59E0B" strokeWidth="1.4" fill="none" />
                <line x1="45.2" y1="48" x2="38" y2="46" stroke="#F59E0B" strokeWidth="1.4" />
                {/* Lens reflection glint */}
                <line x1="49" y1="44" x2="52" y2="43" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
              </g>
            )}

            {/* ── 10. Hooked Raptor Beak (Two-tone with animated speech/thought) ── */}
            <g id="beak">
              {/* Upper hooked beak with sharp charcoal raptor tip */}
              <path
                d="M58 48 Q70 48 76 56 Q75 62 67 60 Q60 58 58 55 Z"
                fill="url(#beakHook)"
                stroke="#1E293B"
                strokeWidth="1"
              />
              {/* Golden nostril cere */}
              <ellipse cx="61" cy="51" rx="1.5" ry="0.8" fill="#78350F" opacity="0.7" />

              {/* Lower mandible (articulates during thinking/speaking) */}
              <g
                id="beak-lower"
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: '58px 57px',
                  animation: isThinking ? 'aguila-talk 0.4s ease-in-out infinite' : 'none',
                }}
              >
                <path
                  d="M58 56 Q66 57 70 59 Q64 63 58 60 Z"
                  fill="#D97706"
                  stroke="#78350F"
                  strokeWidth="0.8"
                />
              </g>
            </g>
          </g>

          {/* ── 11. Celebrating Stars & A+ Emblems ── */}
          {isCelebrating && (
            <g id="celebrating-sparkles">
              <text x="16" y="24" fontSize="12" fill="#F59E0B" fontWeight="bold" fontFamily="monospace">A+</text>
              <text x="96" y="26" fontSize="11" fill="#10B981" fontWeight="bold" fontFamily="monospace">A+</text>
              <text x="10" y="56" fontSize="12" fill="#FBBF24">★</text>
              <text x="104" y="60" fontSize="11" fill="#F59E0B">✦</text>
              <text x="88" y="16" fontSize="10" fill="#3B82F6">✨</text>
            </g>
          )}

          {/* ── 12. Focus Timer Ring / Stopwatch (When timer is running) ── */}
          {isTimer && (
            <g id="timer-badge">
              <circle cx="98" cy="98" r="12" fill="#18181B" stroke="#F59E0B" strokeWidth="1.8" />
              <line x1="98" y1="98" x2="98" y2="90" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="98" y1="98" x2="104" y2="98" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="98" cy="98" r="2" fill="#F59E0B" />
              <rect x="96.5" y="83" width="3" height="3" fill="#D97706" rx="0.5" />
            </g>
          )}
        </svg>

        {/* Realistic Ambient Ground Drop Shadow under perch */}
        <div 
          className="w-28 h-3 bg-neutral-950/70 rounded-[50%] blur-[2px] mt-[-6px] animate-aguila-shadow transition-all"
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
