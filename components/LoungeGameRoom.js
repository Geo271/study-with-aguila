'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  playFootstepSound, playInteractSound, playCoffeeBrewSound,
  playPetSound, playSnackSound, playSitSound,
  isLoungeSoundEnabled, toggleLoungeSound
} from './LoungeAudio'

export const ROOM_SIZE = 1000 // Normalized 1:1 square canvas (1000px by 1000px)
export const AVATAR_W = 54
export const AVATAR_H = 86
export const MOVE_SPEED = 4.2

// ─────────────────────────────────────────────────────────────────────────────
// COLLISION BOXES (AABB)
// Derived from pixel-room.png layout at 1000x1000 scale
// ─────────────────────────────────────────────────────────────────────────────
export const COLLISION_OBSTACLES = [
  // Outer perimeter walls (with doorway gaps)
  { id: 'wall_top', x: 0, y: 0, w: 1000, h: 95 },
  { id: 'wall_bottom', x: 0, y: 920, w: 1000, h: 80 },
  { id: 'wall_left_top', x: 0, y: 0, w: 45, h: 360 },
  { id: 'wall_left_bottom', x: 0, y: 560, w: 45, h: 440 },
  { id: 'wall_right_top', x: 955, y: 0, w: 45, h: 360 },
  { id: 'wall_right_bottom', x: 955, y: 560, w: 45, h: 440 },

  // Top-left: Bookshelves & flower pedestals
  { id: 'bookshelves', x: 50, y: 80, w: 320, h: 185 },

  // Top-center: Kitchen stove, shelves & back wall counter
  { id: 'kitchen_back', x: 380, y: 80, w: 270, h: 180 },

  // Center: Long kitchen/bar counter (walkable above and below, solid in middle)
  { id: 'bar_counter', x: 360, y: 440, w: 310, h: 70 },

  // Middle-left: Coffee table with pink cloth, book & potted plant racks
  { id: 'coffee_table_cluster', x: 120, y: 440, w: 190, h: 125 },

  // Bottom-left: Sofas & armchair cluster
  { id: 'sofa_left', x: 45, y: 730, w: 75, h: 155 },
  { id: 'sofa_right', x: 265, y: 730, w: 75, h: 155 },
  { id: 'sofa_bottom', x: 110, y: 850, w: 165, h: 65 },

  // Center-right: Dining table with tablecloth & cakes
  { id: 'dining_table', x: 535, y: 640, w: 195, h: 135 },

  // Flower planter partitions
  { id: 'planter_left', x: 320, y: 660, w: 45, h: 220 },

  // Bottom chests
  { id: 'bottom_chests', x: 450, y: 850, w: 240, h: 65 },
]

export function checkCollision(x, y, w = AVATAR_W, h = 26) {
  // Feet bounding box at base of avatar
  const footX = x + (AVATAR_W - w) / 2
  const footY = y + AVATAR_H - h
  const footW = w
  const footH = h

  for (const obs of COLLISION_OBSTACLES) {
    if (
      footX < obs.x + obs.w &&
      footX + footW > obs.x &&
      footY < obs.y + obs.h &&
      footY + footH > obs.y
    ) {
      return true
    }
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE STATIONS REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
export const STATIONS = [
  {
    id: 'bookshelf',
    name: 'Study Vault',
    desc: 'Flashcards & Quizzes',
    icon: '📚',
    x: 180,
    y: 285,
    radius: 95,
    prompt: '[E] Open Study Vault',
    category: 'study',
  },
  {
    id: 'coffeebar',
    name: 'Barista Counter',
    desc: 'Brew Matcha / Coffee',
    icon: '☕',
    x: 515,
    y: 380,
    radius: 90,
    prompt: '[E] Brew Fresh Coffee',
    category: 'boost',
  },
  {
    id: 'petdoggo',
    name: 'Cozy Aguila Pup',
    desc: 'Sleeping sweetly',
    icon: '🐶',
    x: 710,
    y: 390,
    radius: 90,
    prompt: '[E] Pet Aguila Doggo',
    category: 'pet',
  },
  {
    id: 'sofa_left',
    name: 'Cozy Sofa',
    desc: 'Deep focus reading',
    icon: '🛋️',
    x: 185,
    y: 770,
    radius: 85,
    prompt: '[E] Sit & Focus',
    category: 'seat',
    seatX: 185,
    seatY: 760,
  },
  {
    id: 'counter_stool_1',
    name: 'Counter Stool',
    desc: 'Cafe vibes',
    icon: '🪑',
    x: 430,
    y: 535,
    radius: 70,
    prompt: '[E] Sit at Counter',
    category: 'seat',
    seatX: 430,
    seatY: 530,
  },
  {
    id: 'counter_stool_2',
    name: 'Counter Stool',
    desc: 'Cafe vibes',
    icon: '🪑',
    x: 580,
    y: 535,
    radius: 70,
    prompt: '[E] Sit at Counter',
    category: 'seat',
    seatX: 580,
    seatY: 530,
  },
  {
    id: 'dining_cake',
    name: 'Strawberry Cake',
    desc: 'Sweet study fuel',
    icon: '🍰',
    x: 635,
    y: 695,
    radius: 95,
    prompt: '[E] Grab Cake Slice',
    category: 'snack',
  },
  {
    id: 'jukebox',
    name: 'Lofi Jukebox',
    desc: 'Study soundtrack',
    icon: '🎵',
    x: 820,
    y: 280,
    radius: 90,
    prompt: '[E] Change Music',
    category: 'music',
  },
  {
    id: 'leaderboard',
    name: 'Hall of Fame',
    desc: 'Room records',
    icon: '🏆',
    x: 780,
    y: 190,
    radius: 85,
    prompt: '[E] View Room Rank',
    category: 'rank',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// QUICK-NAV HUDS
// ─────────────────────────────────────────────────────────────────────────────
export const QUICK_NAV_STATIONS = [
  { id: 'coffeebar', label: 'Cafe Bar', icon: '☕', targetX: 515, targetY: 380 },
  { id: 'sofa_left', label: 'Lounge Sofa', icon: '🛋️', targetX: 185, targetY: 770 },
  { id: 'bookshelf', label: 'Library', icon: '📚', targetX: 180, targetY: 285 },
  { id: 'dining_cake', label: 'Dining Table', icon: '🍰', targetX: 635, targetY: 695 },
  { id: 'petdoggo', label: 'Pet Doggo', icon: '🐶', targetX: 710, targetY: 390 },
]

export default function LoungeGameRoom({
  myPosition,
  setMyPosition,
  otherUsers = {},
  myMeta = {},
  isMoving = false,
  setMovement,
  activeEmotes = {},
  chatMessages = [],
  onOpenFlashcards,
  onOpenQuiz,
  onOpenMusic,
  onOpenPomodoro,
  onOpenLeaderboard,
  onBroadcastBuff,
  token,
}) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1.0)
  const [isSitting, setIsSitting] = useState(false)
  const [facingLeft, setFacingLeft] = useState(false)
  const [targetMove, setTargetMove] = useState(null) // { x, y } click-to-move
  const [clickRipple, setClickRipple] = useState(null)
  const rippleIdRef = useRef(0)
  const [dogHappy, setDogHappy] = useState(false)
  const [coffeeBuff, setCoffeeBuff] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [snackToast, setSnackToast] = useState(null)

  // Pure derivation: latest message per user for in-game speech bubbles
  const speechBubbles = useMemo(() => {
    const bubbles = {}
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i]
      if (msg?.userId && !bubbles[msg.userId] && msg.text && !msg.text.startsWith('[')) {
        bubbles[msg.userId] = { text: msg.text, ts: msg.ts || i }
      }
    }
    return bubbles
  }, [chatMessages])

  // Responsive room auto-fit calculation
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      const margin = 20
      const availableW = clientWidth - margin
      const availableH = clientHeight - margin
      const fitScale = Math.min(availableW / ROOM_SIZE, availableH / ROOM_SIZE, 1.25)
      setScale(Math.max(0.65, fitScale))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Pure derivation: Proximity detection to nearest interactive station
  const activeStation = useMemo(() => {
    const px = myPosition.x + AVATAR_W / 2
    const py = myPosition.y + AVATAR_H / 2
    let nearest = null
    let minDist = Infinity

    for (const st of STATIONS) {
      const dx = px - st.x
      const dy = py - st.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= st.radius && dist < minDist) {
        minDist = dist
        nearest = st
      }
    }
    return nearest
  }, [myPosition])

  // Station trigger execution
  const executeStation = useCallback((station) => {
    if (!station) return
    playInteractSound()

    switch (station.category) {
      case 'study':
        if (onOpenFlashcards) onOpenFlashcards()
        break
      case 'boost':
        playCoffeeBrewSound()
        setCoffeeBuff(true)
        if (onBroadcastBuff) onBroadcastBuff('☕ Matcha Focus +10!')
        setTimeout(() => setCoffeeBuff(false), 8000)
        break
      case 'pet':
        playPetSound()
        setDogHappy(true)
        if (onBroadcastBuff) onBroadcastBuff('❤️ Aguila doggo is purring happily!')
        setTimeout(() => setDogHappy(false), 4500)
        break
      case 'seat':
        playSitSound()
        setIsSitting(true)
        setMyPosition({ x: station.seatX - AVATAR_W / 2, y: station.seatY - AVATAR_H / 2 })
        setTargetMove(null)
        if (onOpenPomodoro) onOpenPomodoro()
        break
      case 'snack':
        playSnackSound()
        setSnackToast('🍰 *nom nom* Strawberry Shortcake! +5 Study Energy')
        setTimeout(() => setSnackToast(null), 3500)
        break
      case 'music':
        if (onOpenMusic) onOpenMusic()
        break
      case 'rank':
        if (onOpenLeaderboard) onOpenLeaderboard()
        break
      default:
        break
    }
  }, [onOpenFlashcards, onOpenPomodoro, onOpenMusic, onOpenLeaderboard, onBroadcastBuff, setMyPosition])

  // Keyboard 'E' / Space interaction & 'ESC' stand up
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key.toLowerCase() === 'e' || e.key === ' ') {
        if (isSitting) {
          setIsSitting(false)
          e.preventDefault()
          return
        }
        if (activeStation) {
          e.preventDefault()
          executeStation(activeStation)
        }
      }

      if (e.key === 'Escape' && isSitting) {
        setIsSitting(false)
      }

      // Footstep sound tick on keydown
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        if (isSitting) setIsSitting(false)
        if (['a', 'ArrowLeft'].includes(e.key)) setFacingLeft(true)
        if (['d', 'ArrowRight'].includes(e.key)) setFacingLeft(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeStation, isSitting, executeStation])

  // Footstep audio loop while walking
  useEffect(() => {
    if (!isMoving) return
    const interval = setInterval(() => {
      playFootstepSound()
    }, 280)
    return () => clearInterval(interval)
  }, [isMoving])

  // Click-to-Move / Tap-to-Move Engine
  const handleFloorClick = (e) => {
    // Only register clicks on the room map surface
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / scale
    const clickY = (e.clientY - rect.top) / scale

    // Stand up if sitting
    if (isSitting) setIsSitting(false)

    // Clamped destination within walkable interior
    const targetX = Math.max(30, Math.min(ROOM_SIZE - AVATAR_W - 30, clickX - AVATAR_W / 2))
    const targetY = Math.max(70, Math.min(ROOM_SIZE - AVATAR_H - 70, clickY - AVATAR_H / 2))

    rippleIdRef.current += 1
    setClickRipple({ x: clickX, y: clickY, id: rippleIdRef.current })
    setTargetMove({ x: targetX, y: targetY })
  }

  // Smooth path movement loop toward click target
  useEffect(() => {
    if (!targetMove) return
    let frameId

    const stepToTarget = () => {
      const { x: curX, y: curY } = myPosition
      const dx = targetMove.x - curX
      const dy = targetMove.y - curY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < MOVE_SPEED) {
        setMyPosition({ x: targetMove.x, y: targetMove.y })
        setTargetMove(null)
        return
      }

      const vx = (dx / dist) * MOVE_SPEED
      const vy = (dy / dist) * MOVE_SPEED

      if (vx < -0.1) setFacingLeft(true)
      else if (vx > 0.1) setFacingLeft(false)

      let nextX = curX + vx
      let nextY = curY + vy

      // Slide collision checking
      const collideBoth = checkCollision(nextX, nextY)
      if (collideBoth) {
        const collideX = checkCollision(nextX, curY)
        const collideY = checkCollision(curX, nextY)

        if (!collideX) nextY = curY
        else if (!collideY) nextX = curX
        else {
          // Both blocked: stop at wall
          setTargetMove(null)
          return
        }
      }

      setMyPosition({ x: nextX, y: nextY })
      frameId = requestAnimationFrame(stepToTarget)
    }

    frameId = requestAnimationFrame(stepToTarget)
    return () => cancelAnimationFrame(frameId)
  }, [targetMove, myPosition, setMyPosition])

  // Quick-Nav teleport / smooth path
  const handleQuickNav = (station) => {
    if (isSitting) setIsSitting(false)
    setTargetMove({ x: station.targetX - AVATAR_W / 2, y: station.targetY - AVATAR_H / 2 })
    rippleIdRef.current += 1
    setClickRipple({ x: station.targetX, y: station.targetY, id: rippleIdRef.current })
    playInteractSound()
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#09090b',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes steamRise {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          25% { opacity: 0.75; }
          65% { transform: translateY(-24px) scale(1.3) translateX(3px); opacity: 0.4; }
          100% { transform: translateY(-44px) scale(1.7) translateX(-3px); opacity: 0; }
        }
        @keyframes candlePulse {
          0%, 100% { opacity: 0.65; transform: scale(1); filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.5)); }
          50% { opacity: 0.95; transform: scale(1.18); filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.8)); }
        }
        @keyframes petSleepZ {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          30% { opacity: 0.85; }
          80% { transform: translate(8px, -24px) scale(1.2); opacity: 0.6; }
          100% { transform: translate(14px, -36px) scale(1.4); opacity: 0; }
        }
        @keyframes petBreathing {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.04, 0.96); }
        }
        @keyframes petHappyWiggle {
          0%, 100% { transform: rotate(0deg) scale(1.05); }
          25% { transform: rotate(-5deg) scale(1.1); }
          75% { transform: rotate(5deg) scale(1.1); }
        }
        @keyframes pulseTarget {
          0% { transform: scale(0.4); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes sunbeamShift {
          0%, 100% { opacity: 0.22; }
          50% { opacity: 0.38; }
        }
        @keyframes dustMote {
          0% { transform: translate(0, 0); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translate(30px, 60px); opacity: 0; }
        }
        @keyframes avatarWalkBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes bubbleDisplay {
          0% { opacity: 0; transform: translate(-50%, 8px) scale(0.92); }
          6% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          82% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -4px) scale(0.96); pointer-events: none; }
        }
        @keyframes bubblePopIn {
          from { opacity: 0; transform: translate(-50%, 10px) scale(0.92); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>

      {/* Floating Snack Toast */}
      {snackToast && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 24, 27, 0.95)',
            border: '1px solid rgba(244, 114, 182, 0.4)',
            color: '#f472b6',
            borderRadius: 12,
            padding: '8px 18px',
            fontSize: 12,
            fontWeight: 700,
            zIndex: 1000,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            animation: 'bubblePopIn 0.2s ease',
          }}
        >
          {snackToast}
        </div>
      )}

      {/* Coffee Focus Buff Toast */}
      {coffeeBuff && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 24, 27, 0.95)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            color: '#4ade80',
            borderRadius: 12,
            padding: '8px 18px',
            fontSize: 12,
            fontWeight: 700,
            zIndex: 1000,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            animation: 'bubblePopIn 0.2s ease',
          }}
        >
          ☕ Matcha Focus Active (+10 Brainpower)!
        </div>
      )}

      {/* Main Room Viewport Canvas */}
      <div
        onClick={handleFloorClick}
        style={{
          width: ROOM_SIZE,
          height: ROOM_SIZE,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'relative',
          cursor: 'crosshair',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#09090b',
        }}
      >
        {/* Layer 1: Pixel Room Base Architecture (1:1 Crisp Pixel Background) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url('/pixel-room.png')`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            zIndex: 1,
          }}
        />

        {/* Layer 2: Ambient Window Sunbeams */}
        <div
          style={{
            position: 'absolute',
            top: 75,
            left: 380,
            width: 250,
            height: 480,
            background: 'linear-gradient(135deg, rgba(254, 240, 138, 0.14) 0%, rgba(254, 240, 138, 0.03) 60%, transparent 100%)',
            clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
            pointerEvents: 'none',
            zIndex: 4,
            animation: 'sunbeamShift 6s ease-in-out infinite',
          }}
        />

        {/* Ambient floating dust motes */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 140 + i * 45,
              left: 420 + (i % 3) * 60,
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: '#fef08a',
              opacity: 0.6,
              zIndex: 5,
              pointerEvents: 'none',
              animation: `dustMote ${4 + i}s linear infinite ${i * 0.8}s`,
            }}
          />
        ))}

        {/* Layer 3: Dynamic Animated Ambient Objects */}

        {/* ☕ Steam from Kitchen Stove & Teapot */}
        <div style={{ position: 'absolute', left: 476, top: 180, zIndex: 6, pointerEvents: 'none' }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: i * 8,
                bottom: 0,
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.7)',
                filter: 'blur(2px)',
                animation: `steamRise 2.4s ease-out infinite ${i * 0.75}s`,
              }}
            />
          ))}
        </div>

        {/* ☕ Steam from Counter Coffee Cups */}
        <div style={{ position: 'absolute', left: 574, top: 432, zIndex: 520, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.65)',
              filter: 'blur(1.5px)',
              animation: 'steamRise 2.1s ease-out infinite 0.4s',
            }}
          />
        </div>

        {/* 🕯️ Candle Flicker Lights */}
        <div
          style={{
            position: 'absolute',
            left: 204,
            top: 145,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fde047 0%, rgba(245, 158, 11, 0.4) 70%, transparent 100%)',
            animation: 'candlePulse 2.8s ease-in-out infinite',
            zIndex: 6,
            pointerEvents: 'none',
          }}
        />

        {/* 🐶 Living Sleeping Aguila Doggo on Mint Rug */}
        <div
          onClick={(e) => {
            e.stopPropagation()
            executeStation(STATIONS.find((s) => s.id === 'petdoggo'))
          }}
          style={{
            position: 'absolute',
            left: 658,
            top: 330,
            width: 82,
            height: 70,
            zIndex: 370,
            cursor: 'pointer',
            animation: dogHappy ? 'petHappyWiggle 0.4s ease-in-out infinite' : 'petBreathing 3.6s ease-in-out infinite',
            transformOrigin: 'bottom center',
          }}
          title="Click to pet Aguila doggo!"
        >
          {/* Floating 'z Z z' sleep bubbles */}
          {!dogHappy && (
            <div style={{ position: 'absolute', top: -14, left: 24, pointerEvents: 'none' }}>
              <span
                style={{
                  position: 'absolute',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#c4b5fd',
                  fontFamily: 'monospace',
                  animation: 'petSleepZ 3s ease-out infinite',
                }}
              >
                z
              </span>
              <span
                style={{
                  position: 'absolute',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#a78bfa',
                  fontFamily: 'monospace',
                  animation: 'petSleepZ 3s ease-out infinite 1.2s',
                }}
              >
                Z
              </span>
            </div>
          )}

          {/* Heart burst when petted */}
          {dogHappy && (
            <div style={{ position: 'absolute', top: -20, left: 16, fontSize: 18, animation: 'bubblePopIn 0.3s ease', pointerEvents: 'none' }}>
              ❤️ ✨
            </div>
          )}
        </div>

        {/* Layer 4: Interactive Hotspots Indicators */}
        {STATIONS.map((station) => {
          const isNearby = activeStation?.id === station.id
          return (
            <div
              key={station.id}
              onClick={(e) => {
                e.stopPropagation()
                executeStation(station)
              }}
              style={{
                position: 'absolute',
                left: station.x - 18,
                top: station.y - 18,
                width: 36,
                height: 36,
                borderRadius: '50%',
                zIndex: station.y,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.23, 1, 0.32, 1)',
                background: isNearby ? 'rgba(99, 102, 241, 0.3)' : 'rgba(0, 0, 0, 0.25)',
                border: isNearby ? '2px solid #818cf8' : '1px dashed rgba(255, 255, 255, 0.2)',
                boxShadow: isNearby ? '0 0 16px rgba(99, 102, 241, 0.6)' : 'none',
                transform: isNearby ? 'scale(1.18)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: 16 }}>{station.icon}</span>

              {/* Floating Proximity Pill Prompt */}
              {isNearby && !isSitting && (
                <div
                  style={{
                    position: 'absolute',
                    top: -38,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(9, 9, 11, 0.95)',
                    border: '1px solid #6366f1',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    zIndex: 999,
                    animation: 'bubblePopIn 0.15s ease',
                  }}
                >
                  <span style={{ background: '#4f46e5', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 900 }}>E</span>
                  <span>{station.prompt.replace('[E] ', '')}</span>
                </div>
              )}
            </div>
          )
        })}

        {/* Sitting HUD Prompt */}
        {isSitting && (
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(17, 17, 19, 0.96)',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: 12,
              padding: '8px 18px',
              fontSize: 12,
              color: '#c7d2fe',
              fontWeight: 700,
              zIndex: 900,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
            }}
          >
            <span>🛋️ Sitting comfortably</span>
            <button
              onClick={() => onOpenPomodoro && onOpenPomodoro()}
              style={{
                background: '#4f46e5',
                border: 'none',
                borderRadius: 8,
                padding: '4px 12px',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Start 25m Focus
            </button>
            <button
              onClick={() => setIsSitting(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: 8,
                padding: '4px 10px',
                color: '#a1a1aa',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Stand [E]
            </button>
          </div>
        )}

        {/* Click Destination Ripple Marker */}
        {clickRipple && (
          <div
            key={clickRipple.id}
            style={{
              position: 'absolute',
              left: clickRipple.x - 12,
              top: clickRipple.y - 12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '2px solid #818cf8',
              pointerEvents: 'none',
              zIndex: clickRipple.y,
              animation: 'pulseTarget 0.55s ease-out forwards',
            }}
          />
        )}

        {/* Layer 5: Kitchen Counter Front Lip (Y-Depth Foreground Occlusion) */}
        {/* At Y: 510, when player stands behind the counter (Y < 480), player is BEHIND it. When in front (Y > 510), player is in FRONT! */}
        <div
          style={{
            position: 'absolute',
            left: 360,
            top: 480,
            width: 310,
            height: 35,
            zIndex: 515,
            pointerEvents: 'none',
            // Uses clip of front wooden edge
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.3))',
            borderRadius: '0 0 6px 6px',
          }}
        />

        {/* Layer 6: Remote Avatars */}
        {Object.entries(otherUsers).map(([uid, u]) => {
          const depthZ = Math.floor((u.y || 500) + AVATAR_H)
          const bubble = speechBubbles[uid]
          return (
            <div
              key={uid}
              style={{
                position: 'absolute',
                left: u.x || 500,
                top: u.y || 500,
                width: AVATAR_W,
                height: AVATAR_H,
                zIndex: depthZ,
                transition: 'left 0.08s linear, top 0.08s linear',
                pointerEvents: 'none',
              }}
            >
              {/* Remote Speech Bubble */}
              {bubble && (
                <div
                  key={bubble.ts}
                  style={{
                    position: 'absolute',
                    bottom: AVATAR_H + 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(9, 9, 11, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 11,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    maxWidth: 180,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    zIndex: depthZ + 50,
                    animation: 'bubbleDisplay 5s ease forwards',
                  }}
                >
                  {bubble.text}
                </div>
              )}

              {/* Avatar Sprite */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  animation: u.isMoving ? 'avatarWalkBounce 0.3s infinite ease-in-out' : 'none',
                }}
              >
                <img
                  src={u.sprite || '/sprites/char1.png'}
                  alt={u.displayName || 'Player'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                />
                <div
                  style={{
                    width: 32,
                    height: 6,
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    marginTop: -6,
                  }}
                />
              </div>

              {/* Remote Name Tag */}
              <div
                style={{
                  position: 'absolute',
                  top: AVATAR_H + 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#d4d4d8',
                  whiteSpace: 'nowrap',
                }}
              >
                {u.displayName || 'Guest'}
              </div>
            </div>
          )
        })}

        {/* Layer 7: Local Player Avatar (Highest interactive precision) */}
        <div
          style={{
            position: 'absolute',
            left: myPosition.x,
            top: myPosition.y,
            width: AVATAR_W,
            height: AVATAR_H,
            zIndex: Math.floor(myPosition.y + AVATAR_H),
            pointerEvents: 'none',
          }}
        >
          {/* Active Emote Float */}
          {activeEmotes[myMeta.userId] && (
            <div
              style={{
                position: 'absolute',
                top: -36,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 26,
                zIndex: 9999,
                animation: 'bubblePopIn 0.2s ease',
              }}
            >
              {activeEmotes[myMeta.userId]}
            </div>
          )}

          {/* Local Speech Bubble */}
          {speechBubbles[myMeta.userId] && (
            <div
              key={speechBubbles[myMeta.userId].ts}
              style={{
                position: 'absolute',
                bottom: AVATAR_H + 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.6)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                color: '#e0e7ff',
                whiteSpace: 'nowrap',
                maxWidth: 220,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                zIndex: 9999,
                animation: 'bubbleDisplay 5s ease forwards',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              }}
            >
              {speechBubbles[myMeta.userId].text}
            </div>
          )}

          {/* Sprite container with walking bounce & left/right facing */}
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'} ${isSitting ? 'translateY(8px)' : ''}`,
              animation: isMoving && !isSitting ? 'avatarWalkBounce 0.28s infinite ease-in-out' : 'none',
              transition: 'transform 0.12s ease',
            }}
          >
            <img
              src={myMeta.sprite || '/sprites/char1.png'}
              alt={myMeta.displayName || 'You'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                imageRendering: 'pixelated',
                filter: coffeeBuff ? 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.8))' : 'none',
              }}
            />
            {/* Ground Contact Shadow */}
            <div
              style={{
                width: isSitting ? 24 : 32,
                height: 5,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.55)',
                marginTop: -5,
              }}
            />
          </div>

          {/* Name Tag */}
          <div
            style={{
              position: 'absolute',
              top: AVATAR_H + 4,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 9,
              fontWeight: 800,
              color: '#818cf8',
              whiteSpace: 'nowrap',
            }}
          >
            {myMeta.displayName || 'You'} (you)
          </div>
        </div>
      </div>

      {/* Floating Game Controls Dock (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(17, 17, 19, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '6px 10px',
          backdropFilter: 'blur(10px)',
          zIndex: 80,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Sound FX Toggle */}
        <button
          onClick={() => setSoundOn(toggleLoungeSound())}
          title={soundOn ? 'Mute Game SFX' : 'Enable Game SFX'}
          style={{
            background: soundOn ? 'rgba(74, 222, 128, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${soundOn ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 8,
            padding: '4px 8px',
            color: soundOn ? '#4ade80' : '#f87171',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {soundOn ? '🔊 SFX' : '🔇 Muted'}
        </button>

        {/* Zoom In / Out / Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: 6 }}>
          <button
            onClick={() => setScale((s) => Math.max(0.55, s - 0.1))}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            -
          </button>
          <span style={{ fontSize: 10, color: '#71717a', fontFamily: 'monospace', minWidth: 32, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(1.4, s + 0.1))}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Quick-Nav Teleport / Path Bar (Bottom Center) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(17, 17, 19, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: '6px 10px',
          backdropFilter: 'blur(10px)',
          zIndex: 80,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          overflowX: 'auto',
          maxWidth: '90vw',
        }}
      >
        <span style={{ fontSize: 9, color: '#71717a', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', paddingRight: 4 }}>
          Jump:
        </span>
        {QUICK_NAV_STATIONS.map((st) => (
          <button
            key={st.id}
            onClick={() => handleQuickNav(st)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 600,
              color: '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <span>{st.icon}</span>
            <span>{st.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
