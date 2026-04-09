'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const playAlarm = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const beepSequence = [0, 0.25, 0.5, 0.75]
    beepSequence.forEach(offset => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + 0.2)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.25)
    })
  } catch (e) {
    console.warn('Audio not available', e)
  }
}

export default function PomodoroTimer({ userId, sessionId, onClose }) {
  const [focusMin, setFocusMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragOrigin = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const boxRef = useRef(null)

  const total = isBreak ? breakMin * 60 : focusMin * 60
  const progress = ((total - secondsLeft) / total) * 100
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')
  const circumference = 2 * Math.PI * 42
  const strokeOffset = circumference - (progress / 100) * circumference

  const handleEnd = useCallback(async () => {
    playAlarm()
    clearInterval(timerRef.current)
    setIsRunning(false)

    if (!isBreak && userId) {
      setCompleted(c => c + 1)
      await supabase.from('pomodoro_sessions').insert([{
        user_id: userId,
        study_session_id: sessionId || null,
        focus_minutes: focusMin,
        break_minutes: breakMin,
        completed: true,
        ended_at: new Date().toISOString(),
      }])
    }
    setIsBreak(b => !b)
    setSecondsLeft(isBreak ? focusMin * 60 : breakMin * 60)
  }, [isBreak, focusMin, breakMin, userId, sessionId])

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { handleEnd(); return 0 }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [isRunning, handleEnd])

  const handleStart = () => { startTimeRef.current = new Date(); setIsRunning(true) }
  const handlePause = async () => {
    clearInterval(timerRef.current)
    setIsRunning(false)
    if (!isBreak && startTimeRef.current && userId) {
      const elapsed = Math.floor((new Date() - startTimeRef.current) / 60000)
      if (elapsed > 0) {
        await supabase.from('pomodoro_sessions').insert([{
          user_id: userId, study_session_id: sessionId || null,
          focus_minutes: focusMin, break_minutes: breakMin,
          completed: false, interrupted_at: elapsed,
          ended_at: new Date().toISOString(),
        }])
      }
    }
  }
  const handleReset = () => {
    clearInterval(timerRef.current)
    setIsRunning(false)
    setIsBreak(false)
    setSecondsLeft(focusMin * 60)
  }
  const applySettings = () => {
    handleReset()
    setShowSettings(false)
  }

  // ── Drag handlers ─────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return
    setDragging(true)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const dx = e.clientX - dragOrigin.current.mx
      const dy = e.clientY - dragOrigin.current.my
      setPos({ x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  // Touch drag
  const onTouchStart = (e) => {
    const t = e.touches[0]
    setDragging(true)
    dragOrigin.current = { mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y }
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const t = e.touches[0]
      const dx = t.clientX - dragOrigin.current.mx
      const dy = t.clientY - dragOrigin.current.my
      setPos({ x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp) }
  }, [dragging])

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed',
        bottom: `${24 - pos.y}px`,
        right: `${24 - pos.x}px`,
        zIndex: 200,
        userSelect: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className={`bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl shadow-black/60 transition-all ${minimized ? 'w-auto' : 'w-72'}`}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-neutral-600'}`}/>
            <span className="text-xs font-semibold text-neutral-300">
              {minimized ? `${mins}:${secs}` : isBreak ? 'Break time' : 'Focus session'}
            </span>
            {!minimized && completed > 0 && (
              <span className="text-xs text-neutral-600">{completed} done</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(s => !s)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
            <button
              onClick={() => setMinimized(m => !m)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                {minimized
                  ? <polyline points="18 15 12 9 6 15"/>
                  : <polyline points="6 9 12 15 18 9"/>}
              </svg>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {!minimized && (
          <div className="p-4">

            {/* Settings panel */}
            {showSettings && (
              <div className="mb-4 p-3 bg-neutral-800 rounded-xl border border-neutral-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-400">Focus (min)</label>
                  <div className="flex items-center gap-2">
                    {[15, 20, 25, 30, 45, 50].map(v => (
                      <button key={v} onClick={() => setFocusMin(v)}
                        className={`px-2 py-0.5 rounded text-xs transition-all ${focusMin === v ? 'bg-indigo-600 text-white' : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-400">Break (min)</label>
                  <div className="flex items-center gap-2">
                    {[3, 5, 10, 15].map(v => (
                      <button key={v} onClick={() => setBreakMin(v)}
                        className={`px-2 py-0.5 rounded text-xs transition-all ${breakMin === v ? 'bg-teal-600 text-white' : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={applySettings}
                  className="w-full py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                  Apply and reset
                </button>
              </div>
            )}

            {/* Timer ring */}
            <div className="flex flex-col items-center py-2">
              <div className="relative w-24 h-24 mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#262626" strokeWidth="8"/>
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={isBreak ? '#0f6e56' : '#4338ca'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-mono font-bold text-white tracking-tight">{mins}:{secs}</span>
                  <span className="text-xs text-neutral-500">{isBreak ? 'break' : 'focus'}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 w-full">
                {!isRunning ? (
                  <button onClick={handleStart}
                    className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all">
                    {secondsLeft === total ? 'Start' : 'Resume'}
                  </button>
                ) : (
                  <button onClick={handlePause}
                    className="flex-1 py-2 bg-neutral-700 text-white text-sm font-medium rounded-xl hover:bg-neutral-600 transition-all">
                    Pause
                  </button>
                )}
                <button onClick={handleReset}
                  className="w-10 h-9 bg-neutral-800 text-neutral-400 text-sm rounded-xl hover:bg-neutral-700 hover:text-white border border-neutral-700 transition-all flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}