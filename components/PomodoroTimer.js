'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function PomodoroTimer({ userId, sessionId }) {
  const [focusMin, setFocusMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const startTimeRef = useRef(null)
  const intervalRef = useRef(null)

  const total = isBreak ? breakMin * 60 : focusMin * 60
  const progress = ((total - secondsLeft) / total) * 100
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            handleTimerEnd()
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning, isBreak])

  const handleTimerEnd = async () => {
    if (!isBreak) {
      setCompletedSessions(c => c + 1)
      await supabase.from('pomodoro_sessions').insert([{
        user_id: userId,
        study_session_id: sessionId || null,
        focus_minutes: focusMin,
        break_minutes: breakMin,
        completed: true,
        ended_at: new Date().toISOString()
      }])
    }
    setIsBreak(b => !b)
    setSecondsLeft(isBreak ? focusMin * 60 : breakMin * 60)
    setIsRunning(false)
  }

  const handleStart = () => {
    startTimeRef.current = new Date()
    setIsRunning(true)
  }

  const handleStop = async () => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
    if (!isBreak && startTimeRef.current) {
      const elapsed = Math.floor((new Date() - startTimeRef.current) / 60000)
      if (elapsed > 0) {
        await supabase.from('pomodoro_sessions').insert([{
          user_id: userId,
          study_session_id: sessionId || null,
          focus_minutes: focusMin,
          break_minutes: breakMin,
          completed: false,
          interrupted_at: elapsed,
          ended_at: new Date().toISOString()
        }])
      }
    }
  }

  const handleReset = () => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
    setIsBreak(false)
    setSecondsLeft(focusMin * 60)
  }

  const applySettings = () => {
    handleReset()
    setSecondsLeft(focusMin * 60)
    setShowSettings(false)
  }

  const circumference = 2 * Math.PI * 54
  const strokeDash = circumference - (progress / 100) * circumference

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {isBreak ? '☕ Break time' : '🎯 Focus session'}
          </h3>
          <p className="text-xs text-neutral-500">{completedSessions} sessions completed</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)}
          className="text-xs text-neutral-400 hover:text-white bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700 transition-colors">
          ⚙️ Settings
        </button>
      </div>

      {showSettings && (
        <div className="mb-4 p-4 bg-neutral-800 rounded-xl border border-neutral-700 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-neutral-400">Focus (min)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setFocusMin(m => Math.max(1, m - 5))}
                className="w-7 h-7 bg-neutral-700 rounded-lg text-sm hover:bg-neutral-600 transition-colors">−</button>
              <span className="text-white text-sm w-6 text-center font-mono">{focusMin}</span>
              <button onClick={() => setFocusMin(m => Math.min(90, m + 5))}
                className="w-7 h-7 bg-neutral-700 rounded-lg text-sm hover:bg-neutral-600 transition-colors">+</button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-neutral-400">Break (min)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setBreakMin(m => Math.max(1, m - 1))}
                className="w-7 h-7 bg-neutral-700 rounded-lg text-sm hover:bg-neutral-600 transition-colors">−</button>
              <span className="text-white text-sm w-6 text-center font-mono">{breakMin}</span>
              <button onClick={() => setBreakMin(m => Math.min(30, m + 1))}
                className="w-7 h-7 bg-neutral-700 rounded-lg text-sm hover:bg-neutral-600 transition-colors">+</button>
            </div>
          </div>
          <button onClick={applySettings}
            className="w-full py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            Apply
          </button>
        </div>
      )}

      <div className="flex flex-col items-center py-4">
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#262626" strokeWidth="8"/>
            <circle cx="60" cy="60" r="54" fill="none"
              stroke={isBreak ? '#0f6e56' : '#4338ca'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              style={{ transition: 'stroke-dashoffset 1s linear' }}/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-mono font-bold text-white">{mins}:{secs}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={handleStart}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all">
              {secondsLeft === (isBreak ? breakMin : focusMin) * 60 ? 'Start' : 'Resume'}
            </button>
          ) : (
            <button onClick={handleStop}
              className="px-6 py-2 bg-neutral-700 text-white text-sm font-medium rounded-xl hover:bg-neutral-600 transition-all">
              Pause
            </button>
          )}
          <button onClick={handleReset}
            className="px-4 py-2 bg-neutral-800 text-neutral-400 text-sm rounded-xl hover:bg-neutral-700 hover:text-white transition-all border border-neutral-700">
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}