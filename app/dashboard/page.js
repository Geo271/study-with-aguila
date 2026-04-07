'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [quizHistory, setQuizHistory] = useState([])
  const [pomodoroStats, setPomodoroStats] = useState(null)
  const [tips, setTips] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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

  const loadStats = async (userId) => {
    // Quiz results
    const { data: quizzes } = await supabase
      .from('quiz_results')
      .select('*, quizzes(title, created_at)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(10)

    // Pomodoro stats
    const { data: pomodoros } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    // Document count
    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Chat count
    const { count: chatCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')

    const completedPomodoros = pomodoros?.filter(p => p.completed) || []
    const totalFocusMin = completedPomodoros.reduce((sum, p) => sum + p.focus_minutes, 0)
    const focusAccuracy = pomodoros?.length
      ? Math.round((completedPomodoros.length / pomodoros.length) * 100)
      : 0

    const avgScore = quizzes?.length
      ? Math.round(quizzes.reduce((sum, q) => sum + (q.score / q.total * 100), 0) / quizzes.length)
      : 0

    setQuizHistory(quizzes || [])
    setPomodoroStats({ totalFocusMin, focusAccuracy, completedPomodoros: completedPomodoros.length, totalSessions: pomodoros?.length || 0 })
    setStats({ docCount: docCount || 0, chatCount: chatCount || 0, avgScore, quizCount: quizzes?.length || 0 })
    generateTips(avgScore, focusAccuracy, docCount || 0)
  }

  const generateTips = (avgScore, focusAccuracy, docCount) => {
    const tips = []
    if (avgScore < 60) tips.push({ icon: '📚', text: 'Your quiz scores suggest reviewing core concepts. Try asking Aguila to explain topics in simpler terms.' })
    if (avgScore >= 60 && avgScore < 80) tips.push({ icon: '🎯', text: 'Good progress! Push yourself with harder questions. Ask Aguila "what are common exam questions about [topic]?"' })
    if (avgScore >= 80) tips.push({ icon: '🏆', text: "Excellent quiz scores! You're mastering the material. Try teaching it back — ask Aguila to quiz you verbally." })
    if (focusAccuracy < 50) tips.push({ icon: '⏱️', text: 'Many focus sessions were interrupted. Try shorter 15-minute sessions to build your focus habit gradually.' })
    if (focusAccuracy >= 80) tips.push({ icon: '🔥', text: "Outstanding focus discipline! You're completing most of your Pomodoro sessions." })
    if (docCount === 0) tips.push({ icon: '📄', text: 'Upload your first PDF notes to get started with AI-powered studying.' })
    if (tips.length === 0) tips.push({ icon: '💡', text: 'Keep studying consistently — even 30 minutes a day compounds over time!' })
    setTips(tips)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-500">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin"/>
          Loading dashboard...
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Study with Aguila 🦅
          </h1>
          <div className="flex gap-2">
            <Link href="/" className="text-xs text-neutral-400 hover:text-white bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700 transition-all">
              ← Back to study
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Your Progress 📊</h2>
          <p className="text-neutral-400 text-sm mt-1">Track your study performance and focus sessions</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'PDFs uploaded', value: stats?.docCount, icon: '📄', color: 'text-indigo-400' },
            { label: 'Questions asked', value: stats?.chatCount, icon: '💬', color: 'text-cyan-400' },
            { label: 'Avg quiz score', value: `${stats?.avgScore || 0}%`, icon: '🎯', color: 'text-green-400' },
            { label: 'Focus sessions', value: pomodoroStats?.completedPomodoros, icon: '⏱️', color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</div>
              <div className="text-xs text-neutral-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Focus Accuracy */}
        {pomodoroStats && pomodoroStats.totalSessions > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-1">Focus accuracy</h3>
            <p className="text-xs text-neutral-500 mb-3">
              {pomodoroStats.completedPomodoros} of {pomodoroStats.totalSessions} sessions completed · {pomodoroStats.totalFocusMin} total focus minutes
            </p>
            <div className="w-full bg-neutral-800 rounded-full h-3">
              <div className="bg-indigo-500 h-3 rounded-full transition-all duration-700"
                style={{ width: `${pomodoroStats.focusAccuracy}%` }}/>
            </div>
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>0%</span>
              <span className="text-indigo-400 font-medium">{pomodoroStats.focusAccuracy}% accuracy</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Quiz History */}
        {quizHistory.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4">Recent quizzes</h3>
            <div className="space-y-3">
              {quizHistory.map((q, i) => {
                const pct = Math.round((q.score / q.total) * 100)
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`text-sm font-bold w-12 text-center ${pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {pct}%
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-neutral-800 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500 w-16 text-right">
                      {q.score}/{q.total}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AI Tips */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">🦅 Aguila's study tips</h3>
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <span className="text-lg flex-shrink-0">{tip.icon}</span>
                <p className="text-sm text-neutral-300 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}