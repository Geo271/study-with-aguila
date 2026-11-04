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
    className={`${className} object-contain`}
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
      t.push({ label: 'First Source', text: 'Upload your first course syllabus or lecture notes to activate vector embeddings.' })
    }
    if (wrongCount > 0) {
      t.push({ label: 'Recall Gap', text: `You have ${wrongCount} flagged question${wrongCount === 1 ? '' : 's'}. Use the Feynman technique in chat to test retention.` })
    }
    if (avgScore > 0 && avgScore < 60) {
      t.push({ label: 'Diagnostic', text: 'Derivation scores indicate foundation gaps. Switch chat engine to Socratic mode for step-by-step guidance.' })
    }
    if (avgScore >= 80) {
      t.push({ label: 'High Mastery', text: 'Exceptional retention across recent decks. Ready for high-pressure exam cram drill.' })
    }
    if (focusAccuracy < 50 && focusAccuracy > 0) {
      t.push({ label: 'Habit Anchor', text: 'Try 15-minute Pomodoro sprints to build sustained cognitive stamina.' })
    }
    if (focusAccuracy >= 80) {
      t.push({ label: 'Deep Discipline', text: 'Top tier focus consistency. You are completing nearly all scheduled focus blocks.' })
    }
    if (t.length === 0) {
      t.push({ label: 'Consistency', text: 'Even 25 focused minutes a day builds 200% higher long-term neural recall.' })
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
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-3 text-neutral-400 font-mono text-xs">
      <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      <span>Calculating Study Analytics...</span>
    </div>
  )

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-5 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
              <EagleLogo />
              <span className="font-bold text-white text-sm tracking-tight hidden sm:inline">Study with Aguila</span>
            </Link>
            <span className="text-neutral-700">|</span>
            <div className="flex items-center gap-2">
              {Icon.spark('w-4 h-4 text-amber-400')}
              <span className="text-xs font-mono font-bold uppercase text-amber-300 tracking-wider">Academic Progress</span>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700/80 transition-all font-medium shadow-xs"
          >
            {Icon.history('w-3.5 h-3.5')}
            <span>Back to Desk</span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Academic Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              badge: 'SOURCES',
              label: 'Course Notes Indexed',
              value: stats?.docCount ?? 0,
              accent: 'text-amber-400',
              icon: 'file',
            },
            {
              badge: 'QUERIES',
              label: 'Academic Prompts',
              value: stats?.chatCount ?? 0,
              accent: 'text-indigo-400',
              icon: 'chat',
            },
            {
              badge: 'RECALL',
              label: 'Avg Exam Score',
              value: stats?.resultCount > 0 ? `${stats.avgScore}%` : '—',
              accent: 'text-emerald-400',
              icon: 'trophy',
            },
            {
              badge: 'STAMINA',
              label: 'Focus Cycles Cleared',
              value: pomodoroStats?.completedPomodoros ?? 0,
              accent: 'text-rose-400',
              icon: 'timer',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] flex flex-col justify-between group hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                  {s.badge}
                </span>
                {Icon[s.icon]?.(`w-3.5 h-3.5 ${s.accent}`)}
              </div>
              <div>
                <div className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${s.accent}`}>
                  {s.value}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Focus Consistency */}
        {pomodoroStats && pomodoroStats.totalSessions > 0 && (
          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Icon.timer('w-4 h-4 text-emerald-400')}
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Pomodoro Focus Retention
                </h3>
              </div>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                {pomodoroStats.completedPomodoros} of {pomodoroStats.totalSessions} sessions completed &bull; {pomodoroStats.totalFocusMin}m deep work
              </span>
            </div>

            <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800 shadow-inner">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${pomodoroStats.focusAccuracy}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-neutral-500 font-mono tabular-nums">
              <span>0% (Distracted)</span>
              <span className="text-emerald-400 font-bold">{pomodoroStats.focusAccuracy}% Completion Rate</span>
              <span>100% (Disciplined)</span>
            </div>
          </div>
        )}

        {/* Recent Exam Performance */}
        {quizHistory.length > 0 ? (
          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                {Icon.trophy('w-4 h-4 text-amber-400')}
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Recent Practice Exam History
                </h3>
              </div>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                {quizHistory.length} Recorded
              </span>
            </div>

            <div className="space-y-3">
              {quizHistory.map((q, i) => {
                const pct = Math.round((q.score / q.total) * 100)
                const date = new Date(q.completed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                const isMastered = pct >= 80
                const isPassing = pct >= 60

                return (
                  <div key={i} className="flex items-center gap-3 bg-neutral-950 border border-neutral-800/80 rounded-xl p-3">
                    <div
                      className={`text-xs font-mono font-bold w-12 text-center py-1 rounded border tabular-nums ${
                        isMastered
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : isPassing
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                      }`}
                    >
                      {pct}%
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-neutral-200 truncate font-sans">
                          {q.quizzes?.title || 'Practice Quiz'}
                        </span>
                        <span className="text-[11px] font-mono text-neutral-400 tabular-nums flex-shrink-0">
                          {q.score}/{q.total} pts
                        </span>
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isMastered ? 'bg-emerald-500' : isPassing ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-neutral-500 hidden sm:block font-mono tabular-nums whitespace-nowrap">
                      {date}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900/60 border-2 border-neutral-800 rounded-2xl p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] space-y-2">
            <p className="text-white text-xs font-mono uppercase font-bold">No Exam Records Yet</p>
            <p className="text-neutral-500 text-xs max-w-sm mx-auto">
              Complete practice tests in your study sessions and your performance analytics will appear here.
            </p>
          </div>
        )}

        {/* Knowledge Gaps to Reinforce */}
        {wrongAreas.length > 0 && (
          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                {Icon.target('w-4 h-4 text-rose-400')}
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Identified Knowledge Gaps
                </h3>
              </div>
              <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold">
                {wrongAreas.length} TO DRILL
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto retro-scroll">
              {wrongAreas.slice(0, 10).map((w, i) => (
                <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-1.5 text-xs">
                  <p className="text-neutral-200 leading-relaxed font-sans">{w.question}</p>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    <span className="font-bold text-emerald-300">Target Concept:</span>
                    <span>{w.correct_answer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aguila Academic Recommendations */}
        <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] space-y-3">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
            {Icon.lightbulb('w-4 h-4 text-amber-400')}
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Aguila Scholar Directives
            </h3>
          </div>
          <div className="space-y-2.5">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-xl"
              >
                <div className="flex-shrink-0 text-[10px] font-bold text-amber-400 pt-0.5 w-24 uppercase font-mono tracking-wider border-r border-neutral-800 pr-2">
                  {tip.label}
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed font-sans">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
