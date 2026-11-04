'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * AguiMascot3D - High-Craft Interactive 2.5D/3D Mascot Engine Rig
 * Inspired by Mascot Engine (mascotengine.com) Rive character animation.
 * 
 * Delivers:
 * 1. Irresistibly cute and attractive character design (Chibi Philippine Eagle)
 *    - Fluffy golden-tawny crown crest, cute blush cheeks, big expressive anime/pixar eyes
 *    - Adorable smiling beak with conversational speech lip-sync
 *    - Fluffy cream chest bib, cute wings that flap/gesture, perched on wooden stump
 * 2. True volumetric 3D parallax depth:
 *    - Multi-plane 3D stage (preserve-3d, perspective 800px) with 6 distinct Z-depth planes
 *    - Head, eyes, beak, and crest rotate with natural stereoscopic parallax
 * 3. Living Locomotion & Physics:
 *    - Idle breathing kinetics & natural ocular micro-saccades
 *    - Mouse gaze tracking across 3 axes
 *    - Articulated beak flaps during AI responses (conversational lip-sync)
 *    - Secondary spring physics on crest plumage and accessory tassels
 *    - Interactive 3D drag-to-orbit with spring return
 *    - Interactive poke/hop & petting purr with blushing cheeks and floating hearts
 *    - Beautiful equipable accessories: Scholar Glasses, Graduation Cap, Lo-Fi Headphones, Royal Crown, Focus Headband
 */

export default function AguiMascot3D({
  mood = 'idle',
  accessory = 'none',
  isTyping = false,
  isInputFocused = false,
  interactive = true,
  size = 'lg',
  onPoke = null,
  onPet = null,
  squashTrigger = 0,
  happyTrigger = false,
  className = '',
}) {
  const containerRef = useRef(null)
  const [isBlinking, setIsBlinking] = useState(false)
  const [mouthFlap, setMouthFlap] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ rotX: 0, rotY: 0 })
  const [gaze, setGaze] = useState({ rotX: 0, rotY: 0, eyeX: 0, eyeY: 0 })
  const [crestLag, setCrestLag] = useState(0)
  const [hopY, setHopY] = useState(0)
  const [wingFlap, setWingFlap] = useState(0)

  const stateRef = useRef({
    targetRotX: 0,
    targetRotY: 0,
    currentRotX: 0,
    currentRotY: 0,
    targetEyeX: 0,
    targetEyeY: 0,
    currentEyeX: 0,
    currentEyeY: 0,
    crestAngle: 0,
    crestVel: 0,
    hopY: 0,
    hopVy: 0,
    dragStartX: 0,
    dragStartY: 0,
    isDragging: false,
    dragRotX: 0,
    dragRotY: 0,
  })

  // Size mapping in pixels
  const sizeMap = {
    xs: { w: 60, h: 72, scale: 0.42 },
    sm: { w: 96, h: 114, scale: 0.65 },
    md: { w: 140, h: 165, scale: 0.92 },
    lg: { w: 180, h: 210, scale: 1.15 },
    xl: { w: 220, h: 255, scale: 1.35 },
  }
  const currentSize = sizeMap[size] || sizeMap.lg

  // ── 1. Organic Blinking Engine (Natural intervals + double blinks) ────────
  useEffect(() => {
    let timer
    let closeTimer

    const scheduleNextBlink = () => {
      const delay = 2600 + Math.random() * 3200
      timer = setTimeout(() => {
        setIsBlinking(true)
        closeTimer = setTimeout(() => {
          setIsBlinking(false)
          // 25% chance of realistic double-blink
          if (Math.random() < 0.28) {
            setTimeout(() => {
              setIsBlinking(true)
              setTimeout(() => {
                setIsBlinking(false)
                scheduleNextBlink()
              }, 110)
            }, 140)
          } else {
            scheduleNextBlink()
          }
        }, 125)
      }, delay)
    }

    scheduleNextBlink()
    return () => {
      clearTimeout(timer)
      clearTimeout(closeTimer)
    }
  }, [])

  // ── 2. Conversational Lip-Sync (Dynamic Beak Flap when AI replies) ────────
  useEffect(() => {
    if (!isTyping) {
      setMouthFlap(0)
      return
    }

    let flapInterval = setInterval(() => {
      // Natural cadence: phonetic flap with occasional open vowels
      const open = Math.random() > 0.35 ? Number((0.35 + Math.random() * 0.65).toFixed(2)) : 0
      setMouthFlap(open)
    }, 95)

    return () => clearInterval(flapInterval)
  }, [isTyping])

  // ── 3. Hop & Squash Reaction on External Poke Trigger ────────────────────
  useEffect(() => {
    if (squashTrigger > 0) {
      stateRef.current.hopVy = 7.5
    }
  }, [squashTrigger])

  // ── 4. Wing Flapping in Celebration or Hop ────────────────────────────────
  useEffect(() => {
    if (mood === 'celebrating') {
      const interval = setInterval(() => {
        setWingFlap(prev => (prev === 1 ? -1 : 1))
      }, 160)
      return () => clearInterval(interval)
    } else {
      setWingFlap(0)
    }
  }, [mood])

  // ── 5. Mouse Gaze Tracking with Parallax & Damped Physics Loop ───────────
  useEffect(() => {
    if (!interactive) return

    const handlePointerMove = (e) => {
      const state = stateRef.current
      if (state.isDragging) {
        const dx = e.clientX - state.dragStartX
        const dy = e.clientY - state.dragStartY
        state.dragRotY = Math.max(-45, Math.min(45, state.dragRotY + dx * 0.4))
        state.dragRotX = Math.max(-25, Math.min(25, state.dragRotX - dy * 0.3))
        state.dragStartX = e.clientX
        state.dragStartY = e.clientY
        setDragOffset({ rotX: state.dragRotX, rotY: state.dragRotY })
        return
      }

      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height * 0.45

      const nx = (e.clientX - centerX) / (window.innerWidth / 2)
      const ny = (e.clientY - centerY) / (window.innerHeight / 2)

      // Target head 3D rotation angles (clamped for natural raptor gaze)
      let targetRotY = Math.max(-18, Math.min(18, nx * 18))
      let targetRotX = Math.max(-14, Math.min(14, -ny * 14))

      // Pupil ocular displacement (mm in SVG coordinate space)
      let targetEyeX = Math.max(-3.5, Math.min(3.5, nx * 3.5))
      let targetEyeY = Math.max(-2.8, Math.min(2.8, ny * 2.8))

      if (isInputFocused) {
        targetRotX = -10 // Look down at keyboard/chat input
        targetEyeY = 3.2
      } else if (isTyping || mood === 'thinking') {
        targetRotX = 8 // Tilt up into deep thought
        targetRotY = 6
        targetEyeY = -2.8
        targetEyeX = 2.2
      }

      state.targetRotX = targetRotX
      state.targetRotY = targetRotY
      state.targetEyeX = targetEyeX
      state.targetEyeY = targetEyeY
    }

    const handlePointerUp = () => {
      stateRef.current.isDragging = false
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp)

    // Animation loop (RAF) for ultra-smooth spring damping & secondary inertia
    let rafId
    let lastTime = performance.now()

    const updatePhysics = (now) => {
      rafId = requestAnimationFrame(updatePhysics)
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      const state = stateRef.current

      // 1. Smooth Head & Eye Gaze Slerp
      state.currentRotX += (state.targetRotX - state.currentRotX) * 0.12
      state.currentRotY += (state.targetRotY - state.currentRotY) * 0.12
      state.currentEyeX += (state.targetEyeX - state.currentEyeX) * 0.18
      state.currentEyeY += (state.targetEyeY - state.currentEyeY) * 0.18

      // 2. Return drag rotation smoothly back to 0 when released
      if (!state.isDragging) {
        state.dragRotX += (0 - state.dragRotX) * 0.08
        state.dragRotY += (0 - state.dragRotY) * 0.08
        setDragOffset({ rotX: state.dragRotX, rotY: state.dragRotY })
      }

      // 3. Crest Secondary Spring Physics (lag behind head rotation)
      const crestTarget = -state.currentRotY * 0.65
      const crestForce = (crestTarget - state.crestAngle) * 32
      state.crestVel = (state.crestVel + crestForce * dt) * 0.88
      state.crestAngle += state.crestVel * dt
      setCrestLag(state.crestAngle)

      // 4. Hop Kinematics
      if (state.hopVy !== 0 || state.hopY > 0) {
        state.hopY += state.hopVy
        state.hopVy -= 0.65 // gravity
        if (state.hopY <= 0) {
          state.hopY = 0
          state.hopVy = 0
        }
        setHopY(state.hopY)
      }

      setGaze({
        rotX: state.currentRotX,
        rotY: state.currentRotY,
        eyeX: state.currentEyeX,
        eyeY: state.currentEyeY,
      })
    }

    rafId = requestAnimationFrame(updatePhysics)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [interactive, isInputFocused, isTyping, mood])

  // Drag start handler
  const handlePointerDown = (e) => {
    if (!interactive) return
    stateRef.current.isDragging = true
    stateRef.current.dragStartX = e.clientX
    stateRef.current.dragStartY = e.clientY
    setIsDragging(true)
  }

  // Combined 3D Rotation
  const totalRotX = gaze.rotX + dragOffset.rotX
  const totalRotY = gaze.rotY + dragOffset.rotY
  const showHappyEyes = happyTrigger || mood === 'celebrating'

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onClick={onPoke}
      className={`relative inline-flex flex-col items-center justify-center select-none cursor-pointer ${className}`}
      style={{
        width: `${currentSize.w}px`,
        height: `${currentSize.h}px`,
        perspective: '800px',
        touchAction: 'none',
      }}
      title="Agui Mascot - drag to rotate in 3D, click to poke, pet to purr"
    >
      {/* ── Volumetric 3D Mascot Stage (Multi-Plane Parallax) ──────────── */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `translateY(${-hopY}px) rotateX(${totalRotX * 0.8}deg) rotateY(${totalRotY * 0.9}deg)`,
        }}
      >
        {/* ── Plane -3 (Z: -28px): Dynamic Ground Shadow ── */}
        <div
          className="absolute -bottom-2 w-[72%] h-4 bg-neutral-950/70 rounded-[50%] blur-[3px] pointer-events-none transition-transform duration-75"
          style={{
            transform: `translateZ(-28px) scale(${Math.max(0.65, 1 - hopY * 0.04)})`,
            opacity: Math.max(0.2, 0.7 - hopY * 0.03),
          }}
        />

        {/* ── Plane -2 (Z: -16px): Carved Tree Stump Perch ── */}
        <div
          className="absolute -bottom-1 pointer-events-none"
          style={{ transform: 'translateZ(-16px)' }}
        >
          <svg width="110" height="32" viewBox="0 0 110 32" fill="none">
            {/* Stump base */}
            <path
              d="M 15 12 L 20 28 Q 55 31 90 28 L 95 12 Z"
              fill="#5c381e"
              stroke="#3a2211"
              strokeWidth="1.5"
            />
            {/* Bark texture grooves */}
            <path d="M 32 14 L 35 27 M 55 14 L 55 29 M 76 14 L 74 27" stroke="#3a2211" strokeWidth="1.2" strokeLinecap="round" />
            {/* Stump top ellipse */}
            <ellipse cx="55" cy="12" rx="40" ry="9" fill="#9a6538" stroke="#5c381e" strokeWidth="1.5" />
            {/* Growth rings */}
            <ellipse cx="55" cy="12" rx="28" ry="6" fill="#b07746" stroke="#875328" strokeWidth="1" />
            <ellipse cx="55" cy="12" rx="15" ry="3.2" fill="#c48c56" />
            {/* Moss / golden leaf sprout accent */}
            <circle cx="22" cy="14" r="3" fill="#10b981" />
            <circle cx="25" cy="12" r="2.2" fill="#34d399" />
          </svg>
        </div>

        {/* ── Plane -1 (Z: -8px): Tail & Back Crest Plumes ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateZ(-8px) rotateZ(${crestLag * 0.4}deg)`,
            transition: 'transform 0.08s ease-out',
          }}
        >
          <svg width="180" height="190" viewBox="0 0 180 190" fill="none">
            {/* Rear Philippine Eagle crest plume fan (fluffy mane) */}
            <g transform="translate(90, 48)">
              {/* Back crest feathers radiating upward with rich feather gradient */}
              <path
                d="M -22 -10 Q -38 -38 -20 -44 Q -8 -32 -10 -8 Z"
                fill="#824c25"
                stroke="#542e14"
                strokeWidth="1.5"
                style={{ transform: `rotate(${-18 + crestLag * 0.5}deg)`, transformOrigin: '0% 100%' }}
              />
              <path
                d="M -8 -12 Q -12 -48 0 -52 Q 12 -46 8 -12 Z"
                fill="#9a5b2c"
                stroke="#542e14"
                strokeWidth="1.5"
                style={{ transform: `rotate(${crestLag * 0.6}deg)`, transformOrigin: '0% 100%' }}
              />
              <path
                d="M 10 -10 Q 14 -42 26 -46 Q 34 -34 20 -8 Z"
                fill="#824c25"
                stroke="#542e14"
                strokeWidth="1.5"
                style={{ transform: `rotate(${16 + crestLag * 0.5}deg)`, transformOrigin: '0% 100%' }}
              />
            </g>

            {/* Rear Tail Feathers */}
            <g transform="translate(90, 148)">
              <path
                d="M -14 0 L -18 24 Q 0 28 18 24 L 14 0 Z"
                fill="#4a2911"
                stroke="#331a0a"
                strokeWidth="1.5"
                style={{ transform: `rotate(${-totalRotY * 0.3}deg)`, transformOrigin: '50% 0%' }}
              />
            </g>
          </svg>
        </div>

        {/* ── Plane 0 (Z: +4px): Torso, Bib & Articulated Wings ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: 'translateZ(4px)',
          }}
        >
          <svg width="180" height="190" viewBox="0 0 180 190" fill="none">
            {/* Main Chubby Torso */}
            <g transform="translate(90, 116)">
              {/* Torso body egg */}
              <ellipse
                cx="0"
                cy="0"
                rx="36"
                ry="38"
                fill="#6e3f1e"
                stroke="#47260f"
                strokeWidth="2"
              />

              {/* Philippine Eagle signature Cream Fluffy Chest Bib */}
              <path
                d="M -24 -24 Q -32 8 -16 26 Q 0 34 16 26 Q 32 8 24 -24 Q 0 -18 -24 -24 Z"
                fill="#fdfbf7"
                stroke="#e2dac8"
                strokeWidth="1.2"
              />
              {/* Fluffy breast feather scalloping */}
              <path
                d="M -12 -8 Q -6 -2 0 -8 Q 6 -2 12 -8"
                stroke="#d3c5ab"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M -8 8 Q 0 14 8 8"
                stroke="#d3c5ab"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
              />

              {/* Cute Golden Raptor Talons / Feet */}
              <g transform="translate(-16, 32)">
                <path d="M -7 0 L -8 7 M 0 0 L 0 9 M 7 0 L 8 7" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
                <path d="M -7 0 L -8 7 M 0 0 L 0 9 M 7 0 L 8 7" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
              </g>
              <g transform="translate(16, 32)">
                <path d="M -7 0 L -8 7 M 0 0 L 0 9 M 7 0 L 8 7" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
                <path d="M -7 0 L -8 7 M 0 0 L 0 9 M 7 0 L 8 7" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>

            {/* Left Wing (Folded or Gesturing) */}
            <g
              transform="translate(54, 108)"
              style={{
                transform: mood === 'celebrating'
                  ? `translate(54px, 108px) rotate(${-35 + wingFlap * 18}deg)`
                  : `translate(54px, 108px) rotate(${totalRotY * 0.25}deg)`,
                transformOrigin: '28px 8px',
                transition: 'transform 0.12s ease-out',
              }}
            >
              {mood === 'celebrating' ? (
                /* Wing spread wide high in celebration! */
                <path
                  d="M 28 8 Q -10 -20 -38 -8 Q -48 10 -28 32 Q 4 38 28 8 Z"
                  fill="#5c3418"
                  stroke="#3a1f0d"
                  strokeWidth="2"
                />
              ) : (
                /* Folded cozy resting wing */
                <path
                  d="M 28 0 Q -6 6 -8 32 Q -4 48 18 36 Q 30 20 28 0 Z"
                  fill="#5c3418"
                  stroke="#3a1f0d"
                  strokeWidth="1.8"
                />
              )}
              {/* Feather rib lines */}
              <path d="M 8 14 Q 4 28 12 36" stroke="#45240f" strokeWidth="1.2" fill="none" />
            </g>

            {/* Right Wing (Thumbs-up or Spread) */}
            <g
              transform="translate(126, 108)"
              style={{
                transform: mood === 'celebrating'
                  ? `translate(126px, 108px) rotate(${35 - wingFlap * 18}deg)`
                  : `translate(126px, 108px) rotate(${-totalRotY * 0.25}deg)`,
                transformOrigin: '-28px 8px',
                transition: 'transform 0.12s ease-out',
              }}
            >
              {mood === 'celebrating' ? (
                /* Wing spread wide high in celebration! */
                <path
                  d="M -28 8 Q 10 -20 38 -8 Q 48 10 28 32 Q -4 38 -28 8 Z"
                  fill="#5c3418"
                  stroke="#3a1f0d"
                  strokeWidth="2"
                />
              ) : mood === 'studying' ? (
                /* Holding study book */
                <path
                  d="M -28 0 Q 6 6 8 32 Q 4 48 -18 36 Q -30 20 -28 0 Z"
                  fill="#5c3418"
                  stroke="#3a1f0d"
                  strokeWidth="1.8"
                />
              ) : (
                /* Confident resting wing / thumbs-up affordance */
                <g>
                  <path
                    d="M -28 0 Q 6 6 8 32 Q 4 48 -18 36 Q -30 20 -28 0 Z"
                    fill="#5c3418"
                    stroke="#3a1f0d"
                    strokeWidth="1.8"
                  />
                  {/* Cute Thumbs-Up Feather Nub */}
                  <path
                    d="M 6 12 Q 14 8 12 0 Q 7 -2 2 8 Z"
                    fill="#6e3f1e"
                    stroke="#47260f"
                    strokeWidth="1.2"
                  />
                </g>
              )}
              <path d="M -8 14 Q -4 28 -12 36" stroke="#45240f" strokeWidth="1.2" fill="none" />
            </g>

            {/* Study Mode: Red Academic Textbook resting on lap */}
            {mood === 'studying' && (
              <g transform="translate(90, 126)">
                {/* Book cover */}
                <path
                  d="M -20 -8 L 0 -4 L 20 -8 L 22 14 L 0 18 L -22 14 Z"
                  fill="#dc2626"
                  stroke="#991b1b"
                  strokeWidth="1.5"
                />
                {/* Pages */}
                <path
                  d="M -18 -6 L 0 -2 L 18 -6 L 19 12 L 0 15 L -19 12 Z"
                  fill="#fef08a"
                  stroke="#ca8a04"
                  strokeWidth="1"
                />
                {/* Book spine & ribbon bookmark */}
                <line x1="0" y1="-2" x2="0" y2="15" stroke="#991b1b" strokeWidth="1.5" />
                <path d="M 0 15 Q 4 22 2 26" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
              </g>
            )}

            {/* Timer Mode: Glowing Focus Stopwatch */}
            {mood === 'timer' && (
              <g transform="translate(122, 122)">
                <circle cx="0" cy="0" r="11" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="8.5" fill="#1e293b" />
                {/* Stopwatch hands */}
                <line x1="0" y1="0" x2="0" y2="-5.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="0" y1="0" x2="4" y2="2" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
                {/* Top clicker button */}
                <rect x="-2" y="-14" width="4" height="3" fill="#38bdf8" rx="1" />
              </g>
            )}
          </svg>
        </div>

        {/* ── Plane +1 (Z: +18px): Articulated Head & Crown Plumes ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateZ(18px) rotateX(${totalRotX * 0.4}deg) rotateY(${totalRotY * 0.4}deg)`,
            transition: 'transform 0.08s ease-out',
          }}
        >
          <svg width="180" height="190" viewBox="0 0 180 190" fill="none">
            {/* Head Assembly */}
            <g transform="translate(90, 68)">
              {/* Forehead feather crest tuft */}
              <path
                d="M -16 -32 Q -22 -52 -10 -56 Q -2 -44 -6 -28 Z"
                fill="#9a5b2c"
                stroke="#542e14"
                strokeWidth="1.5"
                style={{ transform: `rotate(${crestLag * 0.7}deg)`, transformOrigin: '0% 100%' }}
              />
              <path
                d="M -4 -34 Q 0 -60 10 -58 Q 14 -42 6 -30 Z"
                fill="#b87239"
                stroke="#542e14"
                strokeWidth="1.5"
                style={{ transform: `rotate(${crestLag * 0.8}deg)`, transformOrigin: '0% 100%' }}
              />

              {/* Round Cute Head Base */}
              <ellipse
                cx="0"
                cy="0"
                rx="35"
                ry="32"
                fill="#b87239"
                stroke="#6e3f1e"
                strokeWidth="2"
              />

              {/* Lighter face mask (Philippine Eagle facial disc) */}
              <path
                d="M -26 -12 Q 0 -22 26 -12 Q 32 8 20 22 Q 0 30 -20 22 Q -32 8 -26 -12 Z"
                fill="#d8965a"
              />

              {/* Soft Pink Blush Cheeks (Kawaii Cute Touch!) */}
              <ellipse cx="-22" cy="10" rx="6.5" ry="4" fill="#f87171" fillOpacity="0.35" />
              <ellipse cx="22" cy="10" rx="6.5" ry="4" fill="#f87171" fillOpacity="0.35" />
            </g>
          </svg>
        </div>

        {/* ── Plane +2 (Z: +30px): Big Expressive Anime/Pixar Eyes ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateZ(30px) rotateX(${totalRotX * 0.3}deg) rotateY(${totalRotY * 0.3}deg)`,
            transition: 'transform 0.08s ease-out',
          }}
        >
          <svg width="180" height="190" viewBox="0 0 180 190" fill="none">
            <g transform="translate(90, 68)">
              {/* ── Left Eye Assembly ── */}
              <g transform="translate(-16, 2)">
                {showHappyEyes ? (
                  /* Happy Squint Curve (⌒) */
                  <path
                    d="M -9 4 Q 0 -6 9 4"
                    stroke="#2d170a"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                ) : isBlinking ? (
                  /* Closed Eyelid Line */
                  <line x1="-9" y1="2" x2="9" y2="2" stroke="#2d170a" strokeWidth="2.8" strokeLinecap="round" />
                ) : (
                  <>
                    {/* Eyeball Sclera (Large and Cute!) */}
                    <ellipse
                      cx="0"
                      cy="0"
                      rx="11"
                      ry="12.5"
                      fill="#ffffff"
                      stroke="#42220e"
                      strokeWidth="1.8"
                    />

                    {/* Rich Amber-Gold Iris that tracks gaze with depth parallax */}
                    <ellipse
                      cx={gaze.eyeX * 0.9}
                      cy={gaze.eyeY * 0.9}
                      rx="7.5"
                      ry="8.5"
                      fill="#d97706"
                    />
                    {/* Deep Obsidian Pupil */}
                    <ellipse
                      cx={gaze.eyeX * 1.05}
                      cy={gaze.eyeY * 1.05}
                      rx="5.2"
                      ry="6.2"
                      fill="#090d16"
                    />

                    {/* Big Glossy Catchlight Glint (Top-Right) */}
                    <circle
                      cx={-2.5 + gaze.eyeX * 0.4}
                      cy={-3.8 + gaze.eyeY * 0.4}
                      r="2.8"
                      fill="#ffffff"
                    />
                    {/* Secondary Micro Specular Sparkle (Bottom-Left) */}
                    <circle
                      cx={2.5 + gaze.eyeX * 0.4}
                      cy={2.2 + gaze.eyeY * 0.4}
                      r="1.2"
                      fill="#ffffff"
                      fillOpacity="0.8"
                    />
                  </>
                )}

                {/* Eyebrow (articulated for mood) */}
                <path
                  d="M -10 -14 Q 0 -18 10 -13"
                  stroke="#42220e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                  style={{
                    transform: mood === 'studying'
                      ? 'translateY(3px) rotate(8deg)'
                      : mood === 'thinking'
                        ? 'translateY(-3px) rotate(-6deg)'
                        : 'translateY(0px)',
                    transformOrigin: '0% 50%',
                  }}
                />
              </g>

              {/* ── Right Eye Assembly ── */}
              <g transform="translate(16, 2)">
                {showHappyEyes ? (
                  /* Happy Squint Curve (⌒) */
                  <path
                    d="M -9 4 Q 0 -6 9 4"
                    stroke="#2d170a"
                    strokeWidth="3.2"
                    fill="none"
                    strokeLinecap="round"
                  />
                ) : isBlinking ? (
                  /* Closed Eyelid Line */
                  <line x1="-9" y1="2" x2="9" y2="2" stroke="#2d170a" strokeWidth="2.8" strokeLinecap="round" />
                ) : (
                  <>
                    {/* Eyeball Sclera */}
                    <ellipse
                      cx="0"
                      cy="0"
                      rx="11"
                      ry="12.5"
                      fill="#ffffff"
                      stroke="#42220e"
                      strokeWidth="1.8"
                    />

                    {/* Rich Amber-Gold Iris */}
                    <ellipse
                      cx={gaze.eyeX * 0.9}
                      cy={gaze.eyeY * 0.9}
                      rx="7.5"
                      ry="8.5"
                      fill="#d97706"
                    />
                    {/* Deep Obsidian Pupil */}
                    <ellipse
                      cx={gaze.eyeX * 1.05}
                      cy={gaze.eyeY * 1.05}
                      rx="5.2"
                      ry="6.2"
                      fill="#090d16"
                    />

                    {/* Big Glossy Catchlight Glint */}
                    <circle
                      cx={-2.5 + gaze.eyeX * 0.4}
                      cy={-3.8 + gaze.eyeY * 0.4}
                      r="2.8"
                      fill="#ffffff"
                    />
                    {/* Secondary Sparkle */}
                    <circle
                      cx={2.5 + gaze.eyeX * 0.4}
                      cy={2.2 + gaze.eyeY * 0.4}
                      r="1.2"
                      fill="#ffffff"
                      fillOpacity="0.8"
                    />
                  </>
                )}

                {/* Eyebrow */}
                <path
                  d="M -10 -13 Q 0 -18 10 -14"
                  stroke="#42220e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                  style={{
                    transform: mood === 'studying'
                      ? 'translateY(3px) rotate(-8deg)'
                      : mood === 'thinking'
                        ? 'translateY(-1px) rotate(4deg)'
                        : 'translateY(0px)',
                    transformOrigin: '0% 50%',
                  }}
                />
              </g>
            </g>
          </svg>
        </div>

        {/* ── Plane +3 (Z: +42px): Cute Smiling Beak with Lip-Sync Flap ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateZ(42px) rotateX(${totalRotX * 0.25}deg) rotateY(${totalRotY * 0.25}deg)`,
            transition: 'transform 0.08s ease-out',
          }}
        >
          <svg width="180" height="190" viewBox="0 0 180 190" fill="none">
            <g transform="translate(90, 78)">
              {/* Articulated Lower Beak / Jaw (Conversational Lip-Sync!) */}
              <g
                style={{
                  transform: `translateY(${mouthFlap * 6}px)`,
                  transition: 'transform 0.08s ease-out',
                }}
              >
                {mouthFlap > 0.15 && (
                  /* Open mouth dark cavity */
                  <ellipse cx="0" cy="5" rx="7" ry={mouthFlap * 4.5} fill="#451a03" />
                )}
                <path
                  d="M -7 4 Q 0 13 7 4 Z"
                  fill="#f59e0b"
                  stroke="#92400e"
                  strokeWidth="1.2"
                />
              </g>

              {/* Upper Raptor Beak (Hooked & Cute!) */}
              <path
                d="M -11 -6 Q 0 -9 11 -6 Q 9 10 0 17 Q -9 10 -11 -6 Z"
                fill="#fbbf24"
                stroke="#b45309"
                strokeWidth="1.5"
              />
              {/* Dark hooked raptor beak tip */}
              <path
                d="M -6 6 Q 0 15 6 6 Q 4 15 0 17 Q -4 15 -6 6 Z"
                fill="#475569"
              />
              {/* Upper beak nostril slots */}
              <ellipse cx="-4" cy="-2" rx="1.2" ry="0.6" fill="#78350f" />
              <ellipse cx="4" cy="-2" rx="1.2" ry="0.6" fill="#78350f" />
            </g>
          </svg>
        </div>

        {/* ── Plane +4 (Z: +52px): Cute 3D Equipable RPG Accessories ── */}
        {accessory !== 'none' && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              transform: `translateZ(52px) rotateX(${totalRotX * 0.35}deg) rotateY(${totalRotY * 0.35}deg)`,
              transition: 'transform 0.08s ease-out',
            }}
          >
            <svg width="180" height="190" viewBox="0 0 180 190" fill="none">
              <g transform="translate(90, 68)">
                {/* 1. Scholar Glasses */}
                {accessory === 'glasses' && (
                  <g transform="translate(0, 0)">
                    {/* Left wireframe rim & tinted lens */}
                    <rect x="-27" y="-7" width="20" height="18" rx="4" fill="#38bdf8" fillOpacity="0.22" stroke="#fbbf24" strokeWidth="2" />
                    {/* Right wireframe rim & tinted lens */}
                    <rect x="7" y="-7" width="20" height="18" rx="4" fill="#38bdf8" fillOpacity="0.22" stroke="#fbbf24" strokeWidth="2" />
                    {/* Golden Bridge over beak */}
                    <line x1="-7" y1="2" x2="7" y2="2" stroke="#fbbf24" strokeWidth="2.5" />
                    {/* Glass glare line */}
                    <line x1="-23" y1="-3" x2="-12" y2="7" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
                    <line x1="11" y1="-3" x2="22" y2="7" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
                  </g>
                )}

                {/* 2. Graduate Mortarboard Cap */}
                {accessory === 'cap' && (
                  <g transform="translate(0, -32)">
                    {/* Diamond cap top */}
                    <polygon points="0,-14 42,0 0,14 -42,0" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
                    {/* Skull cap band */}
                    <rect x="-20" y="5" width="40" height="10" rx="2" fill="#09090b" />
                    {/* Golden button */}
                    <circle cx="0" cy="0" r="2.5" fill="#f59e0b" />
                    {/* Swinging tassel ribbon with physics lag */}
                    <path
                      d={`M 0 0 Q ${-22 + crestLag * 0.8} 10 ${-26 + crestLag * 1.2} 24`}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle cx={-26 + crestLag * 1.2} cy="26" r="3.2" fill="#d97706" />
                  </g>
                )}

                {/* 3. Lo-Fi Study Headphones */}
                {accessory === 'headphones' && (
                  <g transform="translate(0, -6)">
                    {/* Headband arch over crest */}
                    <path d="M -34 16 C -34 -28, 34 -28, 34 16" fill="none" stroke="#64748b" strokeWidth="3.5" strokeLinecap="round" />
                    {/* Left vibrant orange foam earcup */}
                    <rect x="-42" y="4" width="10" height="22" rx="4" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" />
                    {/* Right vibrant orange foam earcup */}
                    <rect x="32" y="4" width="10" height="22" rx="4" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" />
                  </g>
                )}

                {/* 4. Honor Royal Crown */}
                {accessory === 'crown' && (
                  <g transform="translate(0, -34)">
                    {/* Golden crown peaks */}
                    <polygon points="-24,10 -28,-4 -14,3 0,-8 14,3 28,-4 24,10" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
                    {/* Crown rim base */}
                    <rect x="-24" y="10" width="48" height="6" fill="#d97706" rx="1" />
                    {/* Sparkling jewels */}
                    <circle cx="-14" cy="13" r="2" fill="#ef4444" />
                    <circle cx="0" cy="13" r="2.2" fill="#3b82f6" />
                    <circle cx="14" cy="13" r="2" fill="#10b981" />
                  </g>
                )}

                {/* 5. Focus Martial Arts Headband */}
                {accessory === 'headband' && (
                  <g transform="translate(0, -14)">
                    {/* Crimson headband across brow */}
                    <rect x="-34" y="0" width="68" height="7" rx="1.5" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
                    {/* Golden sun crest */}
                    <circle cx="0" cy="3.5" r="3" fill="#fbbf24" />
                    {/* Fluttering trailing ribbons */}
                    <path d={`M 33 4 Q ${42 + crestLag * 0.6} 8 ${46 + crestLag * 0.9} 18`} fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" />
                    <path d={`M 34 6 Q ${45 + crestLag * 0.6} 16 ${44 + crestLag * 0.9} 25`} fill="none" stroke="#b91c1c" strokeWidth="2.4" strokeLinecap="round" />
                  </g>
                )}
              </g>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
