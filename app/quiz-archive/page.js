'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import QuizMode from '@/components/QuizMode'
import { Icon } from '@/components/Icons'
import { getUserQuizzes, deleteUserQuiz } from '@/app/actions/quiz'

export default function QuizArchive() {
  const [user, setUser] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [activeQuestions, setActiveQuestions] = useState(null)
  const [quizKey, setQuizKey] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchQuizzes(session.user.id)
      setLoading(false)
    }
    load()
  }, [])

  const fetchQuizzes = async (userId) => {
    // 🌟 Uses the secure server action instead of the client!
    const result = await getUserQuizzes(userId);
    if (result.success) {
      setQuizzes(result.quizzes || []);
    } else {
      console.error("Failed to load quizzes:", result.error);
    }
  }

  const handleOpenQuiz = (quiz) => {
    setActiveQuiz(quiz)
    setActiveQuestions(quiz.questions)
    setQuizKey(k => k + 1)
  }

  const handleDeleteQuiz = async (quizId) => {
    setDeletingId(quizId)
    // 🌟 Uses the secure server action to delete!
    const result = await deleteUserQuiz(quizId);
    
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

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      {Icon.spinner('w-6 h-6 text-indigo-400')}
    </div>
  )

  if (activeQuiz && activeQuestions) return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="h-14 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 flex items-center px-4 gap-3">
        <button onClick={() => { setActiveQuiz(null); setActiveQuestions(null) }}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          {Icon.history('w-4 h-4')} Back to Archive
        </button>
        <span className="text-neutral-700">|</span>
        <span className="text-sm font-medium text-neutral-300 truncate">{activeQuiz.title}</span>
      </header>
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 min-h-[500px]">
          <QuizMode key={quizKey} questions={activeQuestions}
            onFinish={() => { setActiveQuiz(null); setActiveQuestions(null) }}
            onRetake={() => setQuizKey(k => k + 1)}/>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="h-14 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 flex items-center px-4 gap-3 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
          {Icon.history('w-4 h-4')}
          <span className="text-sm">Study with Aguila</span>
        </Link>
        <span className="text-neutral-700">|</span>
        <div className="flex items-center gap-2">
          {Icon.archive('w-4 h-4 text-neutral-400')}
          <span className="text-sm font-semibold text-white">Quiz Archive</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-5">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total quizzes', value: quizzes.length },
            { label: 'Total questions', value: quizzes.reduce((s, q) => s + (q.questions?.length || 0), 0) },
            { label: 'Multiple choice', value: quizzes.reduce((s, q) => s + (q.questions?.filter(x => x.type === 'multiple_choice').length || 0), 0) },
          ].map((s, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-indigo-400">{s.value}</div>
              <div className="text-xs text-neutral-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search quizzes..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>

        {/* Quiz list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            {Icon.archive('w-10 h-10 mx-auto text-neutral-700')}
            <p className="text-neutral-500 text-sm">{search ? 'No quizzes match your search' : 'No quizzes yet. Generate one from your notes.'}</p>
            <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              {Icon.plus('w-4 h-4')} Start a study session
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(quiz => {
              const qCount = quiz.questions?.length || 0
              const mcCount = quiz.questions?.filter(q => q.type === 'multiple_choice').length || 0
              const idCount = qCount - mcCount
              const date = new Date(quiz.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <div key={quiz.id} className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {Icon.quiz('w-4 h-4 text-indigo-400 flex-shrink-0')}
                        <h3 className="text-sm font-semibold text-white truncate">{quiz.title}</h3>
                      </div>
                      {quiz.documents?.file_name && (
                        <p className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
                          {Icon.file('w-3 h-3')} {quiz.documents.file_name}
                        </p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs bg-neutral-800 border border-neutral-700 text-neutral-400 px-2 py-0.5 rounded-lg">
                          {qCount} question{qCount !== 1 ? 's' : ''}
                        </span>
                        {mcCount > 0 && (
                          <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-lg">
                            {mcCount} multiple choice
                          </span>
                        )}
                        {idCount > 0 && (
                          <span className="text-xs bg-teal-500/10 border border-teal-500/20 text-teal-400 px-2 py-0.5 rounded-lg">
                            {idCount} identification
                          </span>
                        )}
                        <span className="text-xs text-neutral-600">{date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleOpenQuiz(quiz)}
                        className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition-all font-medium">
                        {Icon.quiz('w-3.5 h-3.5')} Take Quiz
                      </button>
                      <button onClick={() => handleDeleteQuiz(quiz.id)} disabled={deletingId === quiz.id}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-neutral-800 hover:border-red-500/30">
                        {deletingId === quiz.id ? Icon.spinner('w-3.5 h-3.5') : Icon.trash('w-3.5 h-3.5')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}