'use client'

import { useState, useEffect, useRef } from 'react'

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
    "Let me find the best answer in your notes...",
    "Great question. Searching your notes now.",
    "Connecting the concepts from your material.",
    "Working on your answer...",
  ],
  timer: [
    "Focus mode activated. No distractions.",
    "Your session is running. Stay in the zone.",
    "Concentration is a skill. Build it now.",
    "Break incoming. You earned it.",
  ],
}

const ANIMATIONS = `
@keyframes aguiBob {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
@keyframes aguiBobFast {
  0%, 100% { transform: translateY(0px) rotate(-2deg); }
  50% { transform: translateY(-14px) rotate(2deg); }
}
@keyframes aguiWingIdleL {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-5deg); }
}
@keyframes aguiWingIdleR {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(5deg); }
}
@keyframes aguiWingFlapL {
  0%, 100% { transform: rotate(-22deg); }
  50% { transform: rotate(12deg); }
}
@keyframes aguiWingFlapR {
  0%, 100% { transform: rotate(22deg); }
  50% { transform: rotate(-12deg); }
}
@keyframes aguiBeakTalk {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(14deg); }
}
@keyframes aguiTailWag {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(5deg); }
}
@keyframes aguiCrestSway {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-4deg); }
}
@keyframes aguiEyeBlink {
  0%, 88%, 100% { transform: scaleY(1); }
  92% { transform: scaleY(0.06); }
  96% { transform: scaleY(1); }
}
@keyframes aguiEyeBlink2 {
  0%, 72%, 100% { transform: scaleY(1); }
  76% { transform: scaleY(0.06); }
  80% { transform: scaleY(1); }
}
@keyframes aguiGlassesShine {
  0%, 80%, 100% { opacity: 0; }
  85%, 95% { opacity: 0.7; }
}
@keyframes aguiStarFloat {
  0%, 100% { transform: translateY(0px) scale(1); opacity: 1; }
  50% { transform: translateY(-6px) scale(1.2); opacity: 0.8; }
}
@keyframes aguiClockTick {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`

export default function AguiMascot({
  mood = 'idle',
  size = 'md',
  showBubble = true,
  customMessage = '',
  animationDelay = '0s',
}) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [factIndex, setFactIndex] = useState(0)
  const timerRef = useRef(null)
  const factTimerRef = useRef(null)

  const messages = MOOD_MESSAGES[mood] || MOOD_MESSAGES.idle

  useEffect(() => {
    setMsgIndex(0)
    timerRef.current = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length)
    }, 5500)
    return () => clearInterval(timerRef.current)
  }, [mood])

  useEffect(() => {
    factTimerRef.current = setInterval(() => {
      setFactIndex(i => (i + 1) % FACTS.length)
    }, 10000)
    return () => clearInterval(factTimerRef.current)
  }, [])

  const displayMsg = customMessage || messages[msgIndex]

  const isCelebrating = mood === 'celebrating'
  const isTalking = mood === 'thinking'
  const isStudying = mood === 'studying'
  const isTimer = mood === 'timer'

  const sizeMap = { sm: 72, md: 96, lg: 128, xl: 160 }
  const svgSize = sizeMap[size] || 96

  const bobAnim = isCelebrating
    ? `aguiBobFast 0.5s ease-in-out infinite`
    : `aguiBob 2.8s ease-in-out infinite ${animationDelay}`

  const wingLAnim = isCelebrating
    ? `aguiWingFlapL 0.38s ease-in-out infinite`
    : `aguiWingIdleL 3.2s ease-in-out infinite`

  const wingRAnim = isCelebrating
    ? `aguiWingFlapR 0.38s ease-in-out infinite`
    : `aguiWingIdleR 3.2s ease-in-out infinite`

  const beakAnim = isTalking
    ? `aguiBeakTalk 0.32s ease-in-out infinite`
    : `none`

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <style>{ANIMATIONS}</style>

      {showBubble && (
        <div className="relative max-w-[200px] bg-neutral-800 border border-neutral-700 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm">
          <p className="text-xs text-neutral-300 leading-relaxed text-center">{displayMsg}</p>
          <div
            className="absolute -bottom-2 left-4 w-3 h-3 bg-neutral-800 border-b border-l border-neutral-700"
            style={{ transform: 'rotate(-45deg)', borderRadius: '0 0 0 2px' }}
          />
        </div>
      )}

      <div style={{ animation: bobAnim, width: svgSize, height: 'auto', willChange: 'transform' }}>
        <svg
          viewBox="0 0 100 128"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* ── Tail (behind body) ── */}
          <g style={{
            transformBox: 'fill-box',
            transformOrigin: '50% 0%',
            animation: `aguiTailWag 2.1s ease-in-out infinite`,
          }}>
            <path d="M36 106 Q50 122 64 106 Q57 102 50 109 Q43 102 36 106" fill="#5C3D11"/>
            <path d="M40 109 Q50 118 60 109" fill="#4A2F0A" opacity="0.5"/>
            <path d="M44 107 Q50 114 56 107" fill="#8B5E2A" opacity="0.3"/>
          </g>

          {/* ── Left wing (behind body) ── */}
          <g style={{
            transformBox: 'fill-box',
            transformOrigin: '100% 50%',
            animation: wingLAnim,
          }}>
            <path d="M28 70 Q3 66 1 48 Q13 55 23 68" fill="#4A2F0A"/>
            <path d="M28 74 Q4 75 3 60 Q15 63 26 74" fill="#5C3D11"/>
            <path d="M28 78 Q8 80 7 68 Q18 70 27 79" fill="#8B5E2A"/>
          </g>

          {/* ── Body ── */}
          <ellipse cx="50" cy="80" rx="22" ry="27" fill="#8B5E2A"/>
          <ellipse cx="50" cy="85" rx="13" ry="19" fill="#F2DEB0"/>

          {/* ── Right wing (in front of body) ── */}
          <g style={{
            transformBox: 'fill-box',
            transformOrigin: '0% 50%',
            animation: wingRAnim,
          }}>
            {isTimer ? (
              // Holding clock
              <>
                <path d="M72 70 Q92 66 94 50 Q85 57 77 68" fill="#4A2F0A"/>
                <path d="M72 74 Q90 74 92 60 Q83 63 74 74" fill="#5C3D11"/>
                <circle cx="88" cy="60" r="11" fill="#4ECDC4" stroke="#2C9A8A" strokeWidth="1.2"/>
                <circle cx="88" cy="60" r="9" fill="#fff"/>
                <line x1="88" y1="53" x2="88" y2="60" stroke="#2C3E50" strokeWidth="1.3" strokeLinecap="round"/>
                <line
                  x1="88" y1="60" x2="93" y2="62"
                  stroke="#E74C3C" strokeWidth="1.3" strokeLinecap="round"
                  style={{ transformBox: 'fill-box', transformOrigin: '88px 60px', animation: 'aguiClockTick 6s linear infinite' }}
                />
                <circle cx="88" cy="60" r="1.3" fill="#2C3E50"/>
                <rect x="85" y="48" width="6" height="2.5" rx="1" fill="#2C9A8A"/>
              </>
            ) : (
              <>
                <path d="M72 70 Q97 66 99 48 Q87 55 77 68" fill="#4A2F0A"/>
                <path d="M72 74 Q96 75 97 60 Q85 63 74 74" fill="#5C3D11"/>
                <path d="M72 78 Q92 80 93 68 Q82 70 73 79" fill="#8B5E2A"/>
              </>
            )}
          </g>

          {/* ── Neck ── */}
          <ellipse cx="50" cy="45" rx="10" ry="6" fill="#8B5E2A"/>

          {/* ── Crest feathers ── */}
          <g style={{
            transformBox: 'fill-box',
            transformOrigin: '50% 100%',
            animation: `aguiCrestSway 3.8s ease-in-out infinite`,
          }}>
            <polygon points="36,23 39,10 42,22" fill="#4A2F0A"/>
            <polygon points="44,20 47,6 51,19" fill="#5C3D11"/>
            <polygon points="52,22 56,9 59,21" fill="#4A2F0A"/>
          </g>

          {/* ── Head ── */}
          <ellipse cx="50" cy="30" rx="17" ry="16" fill="#8B5E2A"/>

          {/* ── Face mask ── */}
          <ellipse cx="52" cy="32" rx="11.5" ry="9.5" fill="#F2DEB0"/>

          {/* ── Eye (blinks via CSS) ── */}
          <g style={{
            transformBox: 'fill-box',
            transformOrigin: '57px 27px',
            animation: `aguiEyeBlink ${3.5 + Math.random()}s ease-in-out infinite`,
          }}>
            <ellipse cx="57" cy="27" rx="4.5" ry="4" fill="white"/>
            <circle cx="57" cy="27" r="2.8" fill="#1A0800"/>
            <circle cx="58.2" cy="25.8" r="0.9" fill="white"/>
          </g>

          {/* ── Studying glasses overlay ── */}
          {isStudying && (
            <g opacity="0.9">
              <circle cx="51" cy="28" r="5" fill="none" stroke="#4A2F0A" strokeWidth="1.3"/>
              <circle cx="61" cy="28" r="5" fill="none" stroke="#4A2F0A" strokeWidth="1.3"/>
              <line x1="46" y1="28" x2="42" y2="27.5" stroke="#4A2F0A" strokeWidth="1.3"/>
              <line x1="66" y1="28" x2="68" y2="27.5" stroke="#4A2F0A" strokeWidth="1.3"/>
              <line x1="56" y1="28" x2="56" y2="28" stroke="#4A2F0A" strokeWidth="1.3"/>
              {/* Glasses shine */}
              <path
                d="M48 26 Q50 25 51 26"
                stroke="white" strokeWidth="0.8" fill="none"
                style={{ animation: `aguiGlassesShine 5s ease-in-out infinite` }}
              />
            </g>
          )}

          {/* ── Celebrating stars ── */}
          {isCelebrating && (
            <>
              <text
                x="6" y="20" fontSize="9" fill="#F5C218" textAnchor="middle"
                style={{ animation: 'aguiStarFloat 0.6s ease-in-out infinite' }}>★</text>
              <text
                x="86" y="16" fontSize="8" fill="#4ECDC4" textAnchor="middle"
                style={{ animation: 'aguiStarFloat 0.6s ease-in-out infinite 0.2s' }}>✦</text>
              <text
                x="10" y="40" fontSize="7" fill="#FF6B6B" textAnchor="middle"
                style={{ animation: 'aguiStarFloat 0.6s ease-in-out infinite 0.1s' }}>✦</text>
              <text
                x="90" y="38" fontSize="7" fill="#F5C218" textAnchor="middle"
                style={{ animation: 'aguiStarFloat 0.6s ease-in-out infinite 0.3s' }}>★</text>
            </>
          )}

          {/* ── Beak upper ── */}
          <polygon points="64,27 79,30 64,33" fill="#F5C218"/>

          {/* ── Beak lower (animates when talking) ── */}
          <g style={{
            transformBox: 'fill-box',
            transformOrigin: '64px 33px',
            animation: beakAnim,
          }}>
            <polygon points="64,33 77,35 64,38" fill="#D4A017"/>
          </g>

          {/* ── Feet ── */}
          <line x1="43" y1="108" x2="37" y2="120" stroke="#F5C218" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="37" y1="120" x2="31" y2="122" stroke="#F5C218" strokeWidth="2" strokeLinecap="round"/>
          <line x1="37" y1="120" x2="34" y2="126" stroke="#F5C218" strokeWidth="2" strokeLinecap="round"/>
          <line x1="37" y1="120" x2="40" y2="124" stroke="#F5C218" strokeWidth="2" strokeLinecap="round"/>

          <line x1="57" y1="108" x2="63" y2="120" stroke="#F5C218" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="63" y1="120" x2="69" y2="122" stroke="#F5C218" strokeWidth="2" strokeLinecap="round"/>
          <line x1="63" y1="120" x2="66" y2="126" stroke="#F5C218" strokeWidth="2" strokeLinecap="round"/>
          <line x1="63" y1="120" x2="60" y2="124" stroke="#F5C218" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {mood === 'idle' && (
        <p className="text-xs text-neutral-600 italic text-center max-w-[190px] leading-relaxed mt-0.5">
          &ldquo;{FACTS[factIndex]}&rdquo;
        </p>
      )}
    </div>
  )
}