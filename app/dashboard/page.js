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
    // Read from quiz_results (populated by QuizMode on finish)
    const { data: results } = await supabase
      .from('quiz_results')
      .select('*, quizzes(title, created_at)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(20)

    // Fallback: also read quizzes directly to show they exist
    const { data: allQuizzes } = await supabase
      .from('quizzes')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Wrong answers for weak areas analysis
    const { data: wrongAnswers } = await supabase
      .from('quiz_wrong_answers')
      .select('question, correct_answer')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    // Pomodoro
    const { data: pomodoros } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    // Documents
    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Chat messages
    const { count: chatCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')

    const completedPomodoros = pomodoros?.filter(p => p.completed) || []
    const totalFocusMin = completedPomodoros.reduce((s, p) => s + (p.focus_minutes || 0), 0)
    const focusAccuracy = pomodoros?.length
      ? Math.round((completedPomodoros.length / pomodoros.length) * 100) : 0

    // Use quiz_results if available, otherwise show 0%
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

  const buildTips = (avgScore, focusAccuracy, docCount, wrongCount) => {
    const t = []
    if (docCount === 0) {
      t.push({ label: 'Get started', text: 'Upload your first PDF notes to begin AI-powered studying.' })
    }
    if (wrongCount > 0) {
      t.push({ label: 'Review needed', text: `You have ${wrongCount} questions you answered incorrectly. Ask Aguila to explain those topics.` })
    }
    if (avgScore > 0 && avgScore < 60) {
      t.push({ label: 'Quiz scores low', text: 'Try asking Aguila to explain key concepts before retaking the quiz.' })
    }
    if (avgScore >= 80) {
      t.push({ label: 'Excellent scores', text: 'You are mastering the material. Challenge yourself with harder questions.' })
    }
    if (focusAccuracy < 50 && focusAccuracy > 0) {
      t.push({ label: 'Focus interrupted', text: 'Try shorter 15-minute Pomodoro sessions to build your focus habit.' })
    }
    if (focusAccuracy >= 80) {
      t.push({ label: 'Great focus', text: 'Outstanding discipline. You are completing most of your Pomodoro sessions.' })
    }
    if (t.length === 0) {
      t.push({ label: 'Keep going', text: 'Consistency compounds. Even 30 focused minutes a day builds mastery over time.' })
    }
    setTips(t)
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500">
        {Icon.spinner('w-5 h-5 text-indigo-500')}
        Loading dashboard...
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-4 py-3.5">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <EagleLogo/>
            <span className="font-bold text-white text-sm">Progress</span>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700 transition-all">
            {Icon.history('w-3.5 h-3.5')} Back to study
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Files uploaded', value: stats?.docCount ?? 0, color: 'text-indigo-400' },
            { label: 'Questions asked', value: stats?.chatCount ?? 0, color: 'text-cyan-400' },
            { label: 'Avg quiz score', value: stats?.resultCount > 0 ? `${stats.avgScore}%` : '—', color: 'text-green-400' },
            { label: 'Focus sessions', value: pomodoroStats?.completedPomodoros ?? 0, color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-neutral-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Focus accuracy */}
        {pomodoroStats && pomodoroStats.totalSessions > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Focus accuracy</h3>
              <span className="text-xs text-neutral-500">
                {pomodoroStats.completedPomodoros} of {pomodoroStats.totalSessions} completed
                · {pomodoroStats.totalFocusMin} min total
              </span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2.5">
              <div
                className="bg-indigo-500 h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${pomodoroStats.focusAccuracy}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-600 mt-1.5">
              <span>0%</span>
              <span className="text-indigo-400 font-medium">{pomodoroStats.focusAccuracy}% accuracy</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Quiz score history */}
        {quizHistory.length > 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">
              Quiz results
              <span className="text-neutral-600 font-normal ml-2">({quizHistory.length} taken)</span>
            </h3>
            <div className="space-y-3">
              {quizHistory.map((q, i) => {
                const pct = Math.round((q.score / q.total) * 100)
                const date = new Date(q.completed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`text-sm font-bold w-10 text-right flex-shrink-0 ${pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {pct}%
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-neutral-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-neutral-600 w-14 text-right flex-shrink-0">{q.score}/{q.total}</div>
                    <div className="text-xs text-neutral-700 w-14 text-right flex-shrink-0 hidden sm:block">{date}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
            {Icon.quiz('w-8 h-8 mx-auto text-neutral-700 mb-3')}
            <p className="text-neutral-500 text-sm">No quiz results yet.</p>
            <p className="text-neutral-700 text-xs mt-1">Complete a quiz and your scores will appear here.</p>
          </div>
        )}

        {/* Weak areas */}
        {wrongAreas.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Areas to review</h3>
            <p className="text-xs text-neutral-600 mb-4">Questions you answered incorrectly — ask Aguila to explain these.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {wrongAreas.slice(0, 10).map((w, i) => (
                <div key={i} className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
                  <p className="text-xs text-neutral-300 leading-relaxed">{w.question}</p>
                  <p className="text-xs text-green-400 mt-1 font-medium">Answer: {w.correct_answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Aguila's recommendations</h3>
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-3 p-3.5 bg-indigo-500/8 border border-indigo-500/15 rounded-xl">
                <div className="flex-shrink-0 text-xs font-semibold text-indigo-400 pt-0.5 w-24">{tip.label}</div>
                <p className="text-sm text-neutral-300 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}