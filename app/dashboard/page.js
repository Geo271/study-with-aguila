'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Icon } from '@/components/Icons'

const EagleLogo = ({ className = 'w-6 h-6' }) => (
  <img 
    src="/logo.png" 
    alt="Study with Aguila Logo" 
    className={`${className} object-contain rounded-full shadow-sm`}
    style={{ imageRendering: 'pixelated' }} 
  />
)

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [quizHistory, setQuizHistory] = useState([])
  const [wrongAreas, setWrongAreas] = useState([])
  const [pomodoroStats, setPomodoroStats] = useState(null)
  const [tips, setTips] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const buildTips = (avgScore, focusAccuracy, docCount, wrongCount) => {
    const t = []
    if (docCount === 0) {
      t.push({ label: 'Get started', text: 'Upload your first PDF notes to begin AI-powered studying.' })
    }
    if (wrongCount > 0) {
      t.push({ label: 'Review needed', text: `You have ${wrongCount} questions answered incorrectly. Ask Aguila to explain those topics.` })
    }
    if (avgScore > 0 && avgScore < 60) {
      t.push({ label: 'Diagnostic', text: 'Ask Aguila for an overview of key terms before retaking the quiz.' })
    }
    if (avgScore >= 80) {
      t.push({ label: 'High mastery', text: 'You are mastering the material. Challenge yourself with higher question counts.' })
    }
    if (focusAccuracy < 50 && focusAccuracy > 0) {
      t.push({ label: 'Habit building', text: 'Try 15-minute Pomodoro sessions to build sustainable focus stamina.' })
    }
    if (focusAccuracy >= 80) {
      t.push({ label: 'Great discipline', text: 'Outstanding stamina. You are completing most scheduled focus cycles.' })
    }
    if (t.length === 0) {
      t.push({ label: 'Consistency', text: 'Even 25 focused minutes a day builds deep retention over time.' })
    }
    setTips(t)
  }

  const loadStats = async (userId) => {
    const { data: results } = await supabase
      .from('quiz_results')
      .select('*, quizzes(title, created_at)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(20)

    const { data: allQuizzes } = await supabase
      .from('quizzes')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    const { data: wrongAnswers } = await supabase
      .from('quiz_wrong_answers')
      .select('question, correct_answer')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: pomodoros } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: chatCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')

    const completedPomodoros = pomodoros?.filter(p => p.completed) || []
    const totalFocusMin = completedPomodoros.reduce((s, p) => s + (p.focus_minutes || 0), 0)
    const focusAccuracy = pomodoros?.length
      ? Math.round((completedPomodoros.length / pomodoros.length) * 100) : 0

    const avgScore = results?.length
      ? Math.round(results.reduce((s, q) => s + (q.score / q.total * 100), 0) / results.length) : 0

    setQuizHistory(results || [])
    setWrongAreas(wrongAnswers || [])
    setPomodoroStats({
      totalFocusMin,
      focusAccuracy,
      completedPomodoros: completedPomodoros.length,
      totalSessions: pomodoros?.length || 0,
    })
    setStats({
      docCount: docCount || 0,
      chatCount: chatCount || 0,
      avgScore,
      quizCount: allQuizzes?.length || 0,
      resultCount: results?.length || 0,
    })
    buildTips(avgScore, focusAccuracy, docCount || 0, wrongAnswers?.length || 0)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await loadStats(session.user.id)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-400 text-xs font-mono uppercase tracking-wider">
        {Icon.spinner('w-4 h-4 text-amber-500')}
        Loading analytics...
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <EagleLogo/>
            <div>
              <span className="font-semibold text-white text-sm tracking-tight">Study Analytics</span>
              <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">Records</span>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800/90 hover:bg-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-700 transition-all font-medium">
            {Icon.history('w-3.5 h-3.5')} Back to study
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Files uploaded', value: stats?.docCount ?? 0, badge: 'Sources' },
            { label: 'Questions asked', value: stats?.chatCount ?? 0, badge: 'Queries' },
            { label: 'Avg quiz score', value: stats?.resultCount > 0 ? `${stats.avgScore}%` : '—', badge: 'Performance' },
            { label: 'Focus completed', value: pomodoroStats?.completedPomodoros ?? 0, badge: 'Pomodoros' },
          ].map((s, i) => (
            <div key={i} className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 shadow-sm hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">{s.badge}</span>
              </div>
              <div className="text-2xl font-bold font-mono text-white tracking-tight tabular-nums">{s.value}</div>
              <div className="text-xs text-neutral-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Focus consistency */}
        {pomodoroStats && pomodoroStats.totalSessions > 0 && (
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Focus consistency</h3>
              <span className="text-xs text-neutral-400 font-mono tabular-nums">
                {pomodoroStats.completedPomodoros} of {pomodoroStats.totalSessions} completed · {pomodoroStats.totalFocusMin} min total
              </span>
            </div>
            <div className="w-full bg-neutral-800/80 rounded-full h-2 overflow-hidden border border-neutral-700/40">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-700"
                style={{ width: `${pomodoroStats.focusAccuracy}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-500 mt-2 font-mono tabular-nums">
              <span>0%</span>
              <span className="text-emerald-400 font-medium">{pomodoroStats.focusAccuracy}% completed</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Quiz score history */}
        {quizHistory.length > 0 ? (
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Recent exam performance
              </h3>
              <span className="text-xs text-neutral-400 font-mono tabular-nums">
                {quizHistory.length} completed
              </span>
            </div>
            <div className="space-y-3">
              {quizHistory.map((q, i) => {
                const pct = Math.round((q.score / q.total) * 100)
                const date = new Date(q.completed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`text-xs font-mono font-bold w-12 text-right flex-shrink-0 tabular-nums ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {pct}%
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs font-mono text-neutral-400 w-14 text-right flex-shrink-0 tabular-nums">{q.score}/{q.total}</div>
                    <div className="text-xs text-neutral-500 w-16 text-right flex-shrink-0 hidden sm:block font-mono">{date}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-8 text-center shadow-sm">
            <p className="text-neutral-400 text-sm font-medium">No quiz results logged yet.</p>
            <p className="text-neutral-500 text-xs mt-1">Complete a quiz in your study sessions and your performance records will appear here.</p>
          </div>
        )}

        {/* Weak areas */}
        {wrongAreas.length > 0 && (
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1">Knowledge gaps to reinforce</h3>
            <p className="text-xs text-neutral-400 mb-4">Concepts answered incorrectly across your quizzes.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {wrongAreas.slice(0, 10).map((w, i) => (
                <div key={i} className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3">
                  <p className="text-xs text-neutral-200 leading-relaxed">{w.question}</p>
                  <p className="text-xs text-emerald-400 mt-1.5 font-medium font-mono">Correct: {w.correct_answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-4">Aguila&apos;s recommendations</h3>
          <div className="space-y-2.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-3 p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                <div className="flex-shrink-0 text-xs font-semibold text-amber-400 pt-0.5 w-28 uppercase font-mono tracking-wider">{tip.label}</div>
                <p className="text-xs text-neutral-300 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
