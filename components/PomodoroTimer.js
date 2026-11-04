'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/Icons'

const playAlarm = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const beepSequence = [0, 0.22, 0.44, 0.66]
    beepSequence.forEach(offset => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'triangle'
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + offset + 0.02)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + 0.18)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.2)
    })
  } catch (e) {
    // Audio context not available
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
  const progress = total > 0 ? ((total - secondsLeft) / total) * 100 : 0
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
    const nextIsBreak = !isBreak
    setIsBreak(nextIsBreak)
    setSecondsLeft(nextIsBreak ? breakMin * 60 : focusMin * 60)
  }, [isBreak, focusMin, breakMin, userId, sessionId])

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            handleEnd()
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [isRunning, handleEnd])

  const handleStart = () => {
    startTimeRef.current = new Date()
    setIsRunning(true)
  }

  const handlePause = async () => {
    clearInterval(timerRef.current)
    setIsRunning(false)
    if (!isBreak && startTimeRef.current && userId) {
      const elapsed = Math.floor((new Date() - startTimeRef.current) / 60000)
      if (elapsed > 0) {
        await supabase.from('pomodoro_sessions').insert([{
          user_id: userId,
          study_session_id: sessionId || null,
          focus_minutes: focusMin,
          break_minutes: breakMin,
          completed: false,
          interrupted_at: elapsed,
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

  const applySettings = (fMin, bMin) => {
    setFocusMin(fMin)
    setBreakMin(bMin)
    setIsRunning(false)
    setIsBreak(false)
    setSecondsLeft(fMin * 60)
    setShowSettings(false)
  }

  // ── Drag Handlers ──────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return
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
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const onTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return
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
    return () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
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
      className="animate-chat-in font-sans"
    >
      <div
        className={`bg-neutral-900/95 border-2 border-neutral-700/80 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all overflow-hidden text-neutral-100 ${
          minimized ? 'w-auto' : 'w-80'
        }`}
      >
        {/* Retro Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-950 border-b border-neutral-800 select-none">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                isRunning
                  ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                  : 'bg-neutral-600'
              }`}
            />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
              {minimized ? `${mins}:${secs}` : isBreak ? 'Break Mode' : 'Focus Sprint'}
            </span>
            {!minimized && completed > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                {completed} done
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSettings(s => !s)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Configure Focus Intervals"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setMinimized(m => !m)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title={minimized ? 'Expand timer' : 'Minimize timer'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                {minimized ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
              </svg>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Close focus timer"
              >
                {Icon.x('w-3.5 h-3.5')}
              </button>
            )}
          </div>
        </div>

        {/* Expanded Timer View */}
        {!minimized && (
          <div className="p-4 space-y-3.5">
            {/* Settings Overlay Drawer */}
            {showSettings && (
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3 animate-fade-in-up font-mono text-xs">
                <div className="flex items-center justify-between text-neutral-400 text-[11px] font-bold uppercase">
                  <span>Presets</span>
                  <span className="text-amber-400">Deep Work</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Sprint', f: 15, b: 3 },
                    { label: 'Standard', f: 25, b: 5 },
                    { label: 'Deep', f: 50, b: 10 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applySettings(p.f, p.b)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] border transition-all text-center ${
                        focusMin === p.f
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      <div>{p.label}</div>
                      <div className="text-[9px] text-neutral-500">{p.f}m / {p.b}m</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Circular LCD Dial */}
            <div className="flex flex-col items-center py-1">
              <div className="relative w-28 h-28 mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1f1f23" strokeWidth="7" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={isBreak ? '#34d399' : '#fbbf24'}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                  <span className="text-2xl font-mono font-bold text-white tracking-tight tabular-nums">
                    {mins}:{secs}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">
                    {isBreak ? 'Break' : 'Focus'}
                  </span>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex gap-2 w-full pt-1">
                {!isRunning ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-mono font-bold rounded-xl transition-all shadow-xs"
                  >
                    {secondsLeft === total ? 'Start Focus' : 'Resume'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-mono font-bold rounded-xl transition-all shadow-xs"
                  >
                    Pause Sprint
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-10 h-9 bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-xl transition-all flex items-center justify-center shadow-xs"
                  title="Reset interval"
                >
                  {Icon.refresh('w-3.5 h-3.5')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
