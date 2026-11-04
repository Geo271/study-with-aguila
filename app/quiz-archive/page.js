'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import QuizMode from '@/components/QuizMode'
import { Icon } from '@/components/Icons'
import { getUserQuizzes, deleteUserQuiz } from '@/app/actions/quiz'

const EagleLogo = ({ className = 'w-6 h-6' }) => (
  <img
    src="/logo.png"
    alt="Aguila"
    className={`${className} object-contain`}
    style={{ imageRendering: 'pixelated' }}
  />
)

export default function QuizArchive() {
  const [user, setUser] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [activeQuestions, setActiveQuestions] = useState(null)
  const [quizKey, setQuizKey] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')
  const [expandedQuizId, setExpandedQuizId] = useState(null)
  const router = useRouter()

  const fetchQuizzes = async (userId) => {
    const result = await getUserQuizzes(userId)
    if (result.success) {
      setQuizzes(result.quizzes || [])
    } else {
      console.error('Failed to load quizzes:', result.error)
    }
  }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchQuizzes(session.user.id)
      setLoading(false)
    }
    load()
  }, [router])

  const handleOpenQuiz = (quiz) => {
    setActiveQuiz(quiz)
    setActiveQuestions(quiz.questions)
    setQuizKey(k => k + 1)
  }

  const handleDeleteQuiz = async (quizId) => {
    if (!confirm('Are you sure you want to delete this quiz from your archive?')) return
    setDeletingId(quizId)
    const result = await deleteUserQuiz(quizId)
    if (result.success) {
      setQuizzes(prev => prev.filter(q => q.id !== quizId))
      if (activeQuiz?.id === quizId) { setActiveQuiz(null); setActiveQuestions(null) }
    }
    setDeletingId(null)
  }

  const filtered = quizzes.filter(q =>
    q.title?.toLowerCase().includes(search.toLowerCase()) ||
    q.documents?.file_name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalQuestions = quizzes.reduce((s, q) => s + (q.questions?.length || 0), 0)
  const totalMC = quizzes.reduce((s, q) => s + (q.questions?.filter(x => x.type === 'multiple_choice').length || 0), 0)
  const totalID = totalQuestions - totalMC

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-3 text-neutral-400 font-mono text-xs">
      <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      <span>Loading Quiz Archive...</span>
    </div>
  )

  if (activeQuiz && activeQuestions) return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <header className="h-14 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-5 gap-3 sticky top-0 z-20">
        <button
          onClick={() => { setActiveQuiz(null); setActiveQuestions(null) }}
          className="flex items-center gap-2 text-xs font-mono text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-xl border border-neutral-700 transition-all"
        >
          {Icon.history('w-3.5 h-3.5')}
          <span>Exit to Archive</span>
        </button>
        <div className="flex items-center gap-2 min-w-0 max-w-md">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase font-bold">
            Active Drill
          </span>
          <span className="text-xs font-medium text-neutral-200 truncate">{activeQuiz.title}</span>
        </div>
      </header>
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6">
        <div className="bg-neutral-900/95 rounded-2xl border-2 border-neutral-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.85)] min-h-[500px] overflow-hidden">
          <QuizMode
            key={quizKey}
            questions={activeQuestions}
            onFinish={() => { setActiveQuiz(null); setActiveQuestions(null) }}
            onRetake={() => setQuizKey(k => k + 1)}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-5 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
            <EagleLogo />
            <span className="text-sm font-bold text-white tracking-tight hidden sm:inline">Study with Aguila</span>
          </Link>
          <span className="text-neutral-700">|</span>
          <div className="flex items-center gap-2">
            {Icon.archive('w-4 h-4 text-amber-400')}
            <span className="text-xs font-bold font-mono uppercase text-amber-300 tracking-wider">Quiz Archive</span>
          </div>
        </div>

        <Link
          href="/"
          className="text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700/80 transition-all flex items-center gap-1.5 shadow-xs"
        >
          {Icon.plus('w-3.5 h-3.5')}
          <span>New Session</span>
        </Link>
      </header>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Academic Stats Overview Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              {Icon.trophy('w-5 h-5 text-amber-400')}
            </div>
            <div>
              <div className="text-xl font-bold font-mono tabular-nums text-white">{quizzes.length}</div>
              <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Decks Archived</div>
            </div>
          </div>

          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
              {Icon.cards('w-5 h-5 text-indigo-400')}
            </div>
            <div>
              <div className="text-xl font-bold font-mono tabular-nums text-indigo-300">{totalQuestions}</div>
              <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Total Questions</div>
            </div>
          </div>

          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              {Icon.target('w-5 h-5 text-emerald-400')}
            </div>
            <div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-300">
                {totalMC} <span className="text-xs text-neutral-500 font-normal">MC</span> &bull; {totalID} <span className="text-xs text-neutral-500 font-normal">ID</span>
              </div>
              <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Format Breakdown</div>
            </div>
          </div>
        </div>

        {/* Search Bar & Counter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
              {Icon.search('w-4 h-4')}
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quizzes by title or source document..."
              className="w-full bg-neutral-900/90 border-2 border-neutral-800 focus:border-amber-400/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-0.5 rounded"
              >
                {Icon.x('w-3.5 h-3.5')}
              </button>
            )}
          </div>
          <div className="text-[11px] font-mono text-neutral-500 whitespace-nowrap hidden sm:block">
            Showing <span className="text-amber-400 font-bold tabular-nums">{filtered.length}</span> of {quizzes.length}
          </div>
        </div>

        {/* Quiz List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/50 border-2 border-neutral-800/80 rounded-2xl p-8 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Aguila"
                className="w-9 h-9 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <h3 className="text-sm font-bold font-mono text-white uppercase">
              {search ? 'No Quizzes Found' : 'Archive Empty'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {search
                ? `No quizzes matched "${search}". Try a different keyword.`
                : 'Upload PDF lecture notes in the main desk to generate AI practice quizzes.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono transition-all font-semibold"
            >
              {Icon.plus('w-3.5 h-3.5')}
              <span>Upload Notes &amp; Generate Quiz</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(quiz => {
              const qCount = quiz.questions?.length || 0
              const mcCount = quiz.questions?.filter(q => q.type === 'multiple_choice').length || 0
              const idCount = qCount - mcCount
              const date = new Date(quiz.created_at).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
              const isExpanded = expandedQuizId === quiz.id

              return (
                <div
                  key={quiz.id}
                  className="bg-neutral-900/90 border-2 border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 sm:p-5 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                          {qCount} {qCount === 1 ? 'ITEM' : 'ITEMS'}
                        </span>
                        <h3 className="text-sm font-semibold text-white truncate font-sans">
                          {quiz.title}
                        </h3>
                      </div>

                      {quiz.documents?.file_name && (
                        <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1.5 font-mono">
                          {Icon.file('w-3 h-3 text-neutral-500')}
                          <span className="truncate">{quiz.documents.file_name}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                        {mcCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-indigo-300">
                            {mcCount} Multiple Choice
                          </span>
                        )}
                        {idCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-teal-300">
                            {idCount} Identification
                          </span>
                        )}
                        <span className="text-neutral-500 tabular-nums ml-1">
                          Generated {date}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedQuizId(isExpanded ? null : quiz.id)}
                        className="px-3 py-2 text-xs font-mono text-neutral-300 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded-xl border border-neutral-700 transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-amber-400' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <span>{isExpanded ? 'Hide' : 'Preview'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenQuiz(quiz)}
                        className="flex items-center gap-1.5 text-xs font-mono font-bold bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border border-amber-500/40 px-3.5 py-2 rounded-xl transition-all shadow-xs"
                      >
                        {Icon.quiz('w-3.5 h-3.5 text-amber-400')}
                        <span>Take Quiz</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        disabled={deletingId === quiz.id}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-neutral-800 hover:border-red-500/30"
                        title="Delete quiz"
                      >
                        {deletingId === quiz.id ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Question Preview Drawer */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-2.5 animate-fade-in-up">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1">
                        <span>Questions Preview &bull; {quiz.questions?.length || 0} Total</span>
                        <span className="text-amber-400">Model Answers Verified</span>
                      </div>

                      {quiz.questions?.map((q, i) => (
                        <div
                          key={q.id || i}
                          className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs font-sans space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-amber-400 font-mono font-bold text-xs">
                              Q{i + 1}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 uppercase">
                              {q.type?.replace('_', ' ') || 'Question'}
                            </span>
                          </div>
                          <p className="text-neutral-200 leading-relaxed font-medium">
                            {q.question}
                          </p>
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                              <span className="font-bold text-emerald-300">Answer:</span>
                              <span>{q.answer}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
