'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { processPDF, createSession, processOCR } from './actions/pdf'
import {
  askDocument, getSessions, getArchivedSessions,
  archiveSession, restoreSession, getSessionMessages,
} from './actions/chat'
import { generateQuiz } from './actions/quiz'
import { checkEulaAccepted } from './actions/tasks'
import QuizMode from '@/components/QuizMode'
import PomodoroTimer from '@/components/PomodoroTimer'
import AguiMascot from '@/components/AguiMascot'
import { Icon } from '@/components/Icons'
import ReactMarkdown from 'react-markdown'

// ── Inline SVG logo ───────────────────────────────────────────────────
const EagleLogo = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" className={className}>
    <polygon points="14,14 16,6 19,13" fill="#4A2F0A"/>
    <polygon points="18,12 21,4 24,11" fill="#5C3D11"/>
    <polygon points="22,11 25,3 28,10" fill="#4A2F0A"/>
    <ellipse cx="24" cy="23" rx="13" ry="12" fill="#8B5E2A"/>
    <ellipse cx="25" cy="25" rx="8.5" ry="7.5" fill="#F2DEB0"/>
    <polygon points="33,22 42,25 33,28" fill="#F5C218"/>
    <circle cx="29" cy="22" r="3" fill="#1A0800"/>
    <circle cx="30" cy="21" r="0.8" fill="#fff"/>
    <ellipse cx="24" cy="42" rx="13" ry="11" fill="#8B5E2A"/>
    <ellipse cx="24" cy="44" rx="7" ry="7.5" fill="#F2DEB0"/>
    <path d="M11 38 Q2 44 4 52 Q12 46 19 44" fill="#5C3D11"/>
    <path d="M37 38 Q46 44 44 52 Q36 46 29 44" fill="#5C3D11"/>
  </svg>
)

// ── Paper-clip / attachment icon ─────────────────────────────────────
const AttachIcon = ({ cls = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
)

// ── Camera / scan icon ───────────────────────────────────────────────
const ScanIcon = ({ cls = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ── File state pill ──────────────────────────────────────────────────
function FilePill({ name, state }) {
  const icons = {
    pending: Icon.file('w-3.5 h-3.5 text-neutral-500'),
    uploading: Icon.spinner('w-3.5 h-3.5 text-indigo-400'),
    done: Icon.check('w-3.5 h-3.5 text-green-400'),
    error: Icon.x('w-3.5 h-3.5 text-red-400'),
  }
  return (
    <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs min-w-0 max-w-[200px]">
      {icons[state] || icons.pending}
      <span className="truncate text-neutral-300">{name}</span>
    </div>
  )
}

// ── Session list item ────────────────────────────────────────────────
function SessionItem({ session, isActive, onClick, onArchive, onRestore, isArchived }) {
  const [showActions, setShowActions] = useState(false)
  return (
    <div
      className={`group relative rounded-xl transition-all cursor-pointer ${
        isActive ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-neutral-800 border border-transparent'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button onClick={onClick} className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 min-w-0">
        {Icon.file('w-4 h-4 flex-shrink-0 mt-0.5 ' + (isActive ? 'text-indigo-400' : 'text-neutral-600'))}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium truncate ${isActive ? 'text-indigo-200' : 'text-neutral-300 group-hover:text-white'}`}>
            {session.title}
          </p>
          <p className="text-xs text-neutral-700">
            {session.session_documents?.length || 0} PDF{session.session_documents?.length !== 1 ? 's' : ''}
          </p>
        </div>
      </button>
      {showActions && (
        <button
          onClick={(e) => { e.stopPropagation(); isArchived ? onRestore(session.id) : onArchive(session.id) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-neutral-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
        >
          {isArchived ? Icon.refresh('w-3 h-3') : Icon.archive('w-3 h-3')}
        </button>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()

  // Auth
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Sessions
  const [sessions, setSessions] = useState([])
  const [archivedSessions, setArchivedSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [uploadedDocs, setUploadedDocs] = useState([])

  // Chat
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const cancelRef = useRef(false)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const inputRef = useRef(null)

  // Upload tray (staged files before processing)
  const [uploadTray, setUploadTray] = useState([]) // [{ file, state, type }]
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)

  // Extra PDFs to existing session
  const [extraTray, setExtraTray] = useState([])
  const [addingExtra, setAddingExtra] = useState(false)

  // Quiz
  const [mode, setMode] = useState('chat')
  const [quizQuestions, setQuizQuestions] = useState(null)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [quizKey, setQuizKey] = useState(0)
  const [autoQuizReady, setAutoQuizReady] = useState(null)

  // Mascot
  const [mascotMood, setMascotMood] = useState('idle')

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [historyTab, setHistoryTab] = useState('active')
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showFAB, setShowFAB] = useState(false)
  const [showExtraInput, setShowExtraInput] = useState(false)

  // ── Auth + EULA ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { accepted } = await checkEulaAccepted(session.user.id)
      if (!accepted) { router.push('/eula'); return }
      setUser(session.user)
      setAuthLoading(false)
      await refreshSessions(session.user.id)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Scroll FAB ────────────────────────────────────────────────────
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const onScroll = () => setShowFAB(el.scrollHeight - el.scrollTop - el.clientHeight > 220)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [currentSession])

  useEffect(() => {
    if (!showFAB) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // ── Sessions ──────────────────────────────────────────────────────
  const refreshSessions = async (uid) => {
    const id = uid || user?.id
    if (!id) return
    const [a, b] = await Promise.all([getSessions(id), getArchivedSessions(id)])
    if (a.success) setSessions(a.sessions)
    if (b.success) setArchivedSessions(b.sessions)
  }

  const loadSession = async (session) => {
    setLoadingHistory(true)
    setCurrentSession(session)
    setUploadedDocs(session.session_documents?.map(d => d.document_id) || [])
    setMode('chat')
    setSidebarOpen(false)
    setQuizQuestions(null)
    setAutoQuizReady(null)
    setMascotMood('idle')
    setUploadTray([])
    setExtraTray([])
    setShowExtraInput(false)

    const result = await getSessionMessages(session.id)
    setMessages(
      result.success && result.messages.length
        ? result.messages.map(m => ({ role: m.role, content: m.content }))
        : [{ role: 'ai', content: `Welcome back to **${session.title}**. Ask me anything about your notes.` }]
    )
    setLoadingHistory(false)
    inputRef.current?.focus()
  }

  const handleArchive = async (sessionId) => {
    await archiveSession(sessionId)
    if (currentSession?.id === sessionId) {
      setCurrentSession(null); setMessages([]); setUploadedDocs([])
    }
    await refreshSessions()
  }

  const handleRestore = async (sessionId) => {
    await restoreSession(sessionId)
    await refreshSessions()
  }

  const handleNewChat = () => {
    setCurrentSession(null)
    setMessages([])
    setUploadedDocs([])
    setUploadTray([])
    setExtraTray([])
    setQuizQuestions(null)
    setAutoQuizReady(null)
    setMode('chat')
    setMascotMood('idle')
    setSidebarOpen(false)
    setShowExtraInput(false)
  }

  // ── File staging ──────────────────────────────────────────────────
  const stageFiles = (fileList, type = 'pdf') => {
    const valid = Array.from(fileList).slice(0, 3)
    const items = valid.map(f => ({ file: f, state: 'pending', type }))
    setUploadTray(prev => [...prev, ...items].slice(0, 3))
  }

  const removeTrayItem = (idx) => {
    setUploadTray(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Start session ─────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!uploadTray.length) return
    setIsProcessing(true)
    setMascotMood('studying')

    const firstFile = uploadTray[0].file
    const autoTitle = firstFile.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_\-\[\]()]+/g, ' ')
      .trim()

    const sessionResult = await createSession(user.id, autoTitle)
    if (!sessionResult.success) { setIsProcessing(false); setMascotMood('idle'); return }

    const session = sessionResult.session
    const docIds = []
    let firstExtractedText = ''

    for (let i = 0; i < uploadTray.length; i++) {
      const item = uploadTray[i]
      setUploadTray(prev => prev.map((p, idx) => idx === i ? { ...p, state: 'uploading' } : p))

      const fd = new FormData()
      fd.append('file', item.file)

      let result
      if (item.type === 'ocr') {
        result = await processOCR(fd, user.id, session.id)
      } else {
        result = await processPDF(fd, user.id, session.id)
      }

      setUploadTray(prev => prev.map((p, idx) => idx === i ? { ...p, state: result.success ? 'done' : 'error' } : p))
      if (result.success) {
        docIds.push(result.documentId)
        if (i === 0) firstExtractedText = result.extractedText || ''
      }
    }

    setCurrentSession(session)
    setUploadedDocs(docIds)
    setMascotMood('idle')
    setMessages([{
      role: 'ai',
      content: `Session **"${autoTitle}"** is ready. Processed ${docIds.length} file${docIds.length > 1 ? 's' : ''}. Ask me anything or I'll generate a quiz automatically.`,
    }])

    await refreshSessions()

    if (docIds.length && firstExtractedText) {
      setIsGeneratingQuiz(true)
      const quizResult = await autoGenerateQuiz(docIds[0], user.id, session.id, firstExtractedText)
      setIsGeneratingQuiz(false)
      if (quizResult.success) {
        setAutoQuizReady(quizResult.questions)
        setMessages(prev => [...prev, {
          role: 'ai',
          content: `A 5-question quiz has been automatically generated from your notes. Tap **Start Quiz** below to begin.`,
        }])
      }
    }

    setUploadTray([])
    setIsProcessing(false)
    inputRef.current?.focus()
  }

  // ── Add extra files to existing session ───────────────────────────
  const handleAddExtra = async () => {
    if (!extraTray.length || !currentSession) return
    setAddingExtra(true)

    const newDocs = [...uploadedDocs]
    for (let i = 0; i < extraTray.length; i++) {
      const item = extraTray[i]
      setExtraTray(prev => prev.map((p, idx) => idx === i ? { ...p, state: 'uploading' } : p))
      const fd = new FormData()
      fd.append('file', item.file)
      const r = item.type === 'ocr'
        ? await processOCR(fd, user.id, currentSession.id)
        : await processPDF(fd, user.id, currentSession.id)
      setExtraTray(prev => prev.map((p, idx) => idx === i ? { ...p, state: r.success ? 'done' : 'error' } : p))
      if (r.success) newDocs.push(r.documentId)
    }

    setUploadedDocs(newDocs)
    setAddingExtra(false)
    setExtraTray([])
    setShowExtraInput(false)
    setMessages(prev => [...prev, {
      role: 'ai',
      content: `Added ${extraTray.length} more file${extraTray.length > 1 ? 's' : ''} to this session.`,
    }])
    await refreshSessions()
  }

  // ── Send message ──────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault()
    const msg = input.trim()
    if (!msg || !currentSession || isTyping) return

    cancelRef.current = false
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setIsTyping(true)
    setMascotMood('thinking')

    const result = await askDocument(msg, currentSession.id, user.id)

    if (cancelRef.current) { setIsTyping(false); setMascotMood('idle'); return }
    setIsTyping(false)
    setMascotMood('idle')

    if (result.success) {
      const answer = result.answer
      const triggerMatch = answer.match(/\[TRIGGER_QUIZ:(\d+)\]/)
      if (triggerMatch) {
        const count = parseInt(triggerMatch[1])
        setMessages(prev => [...prev, { role: 'ai', content: `Generating a ${count}-question quiz from your notes...` }])
        setIsGeneratingQuiz(true)
        const qr = await generateQuiz(uploadedDocs[0], user.id, count, currentSession.id)
        setIsGeneratingQuiz(false)
        if (qr.success) { setQuizQuestions(qr.questions); setMode('quiz') }
        return
      }
      setMessages(prev => [...prev, { role: 'ai', content: answer }])
    } else {
      setMessages(prev => [...prev, { role: 'ai', content: 'Something went wrong. Please try again.' }])
    }
  }

  const handleCancel = () => {
    cancelRef.current = true
    setIsTyping(false)
    setMascotMood('idle')
    setMessages(prev => [...prev, { role: 'ai', content: 'Response cancelled.' }])
  }

  const handleGenerateQuiz = async () => {
    if (autoQuizReady) { setQuizQuestions(autoQuizReady); setMode('quiz'); return }
    if (!uploadedDocs.length) return
    setIsGeneratingQuiz(true)
    const result = await generateQuiz(uploadedDocs[0], user.id, 5, currentSession?.id)
    setIsGeneratingQuiz(false)
    if (result.success) { setQuizQuestions(result.questions); setMode('quiz') }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        {Icon.spinner('w-6 h-6 text-indigo-400')}
      </div>
    )
  }

  // ── Sidebar content (shared between desktop + mobile) ─────────────
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex-shrink-0 p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <EagleLogo className="w-6 h-6"/>
          <span className="font-bold text-white text-sm leading-tight">Menu</span>
        </div>
        {/* Close on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-neutral-500 transition-colors"
        >
          {Icon.x('w-4 h-4')}
        </button>
      </div>

      {/* New chat */}
      <div className="flex-shrink-0 p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all active:scale-[0.98]"
        >
          {Icon.plus('w-4 h-4')}
          New session
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          {['active', 'archived'].map(tab => (
            <button
              key={tab}
              onClick={() => setHistoryTab(tab)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                historyTab === tab
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {tab}
              <span className="ml-1 opacity-60">
                ({(tab === 'active' ? sessions : archivedSessions).length})
              </span>
            </button>
          ))}
        </div>

        {(historyTab === 'active' ? sessions : archivedSessions).length === 0 ? (
          <p className="text-xs text-neutral-700 text-center py-6">
            {historyTab === 'active' ? 'No sessions yet' : 'Nothing archived'}
          </p>
        ) : (historyTab === 'active' ? sessions : archivedSessions).map(s => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={currentSession?.id === s.id}
            isArchived={historyTab === 'archived'}
            onClick={() => historyTab === 'active' && loadSession(s)}
            onArchive={handleArchive}
            onRestore={handleRestore}
          />
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t border-neutral-800 p-3 space-y-1">
        {[
          { label: 'Quiz archive', icon: Icon.archive, href: '/quiz-archive' },
          { label: 'My tasks', icon: Icon.quiz, href: '/tasks' },
          { label: 'Progress', icon: Icon.chart, href: '/dashboard' },
          { label: 'Focus timer', icon: Icon.clock, action: () => { setShowPomodoro(p => !p); setSidebarOpen(false) } },
          { label: 'About', icon: Icon.history, href: '/about' },
        ].map((item, i) => item.href ? (
          <Link
            key={i}
            href={item.href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
          >
            {item.icon('w-3.5 h-3.5')} {item.label}
          </Link>
        ) : (
          <button
            key={i}
            onClick={item.action}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
          >
            {item.icon('w-3.5 h-3.5')} {item.label}
          </button>
        ))}

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg mt-1">
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{user?.email?.[0]?.toUpperCase()}</span>
          </div>
          <span className="text-xs text-neutral-600 truncate flex-1 min-w-0">{user?.email}</span>
          <button onClick={handleLogout} className="text-neutral-700 hover:text-red-400 transition-colors flex-shrink-0">
            {Icon.logout('w-3.5 h-3.5')}
          </button>
        </div>
      </div>
    </>
  )

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-neutral-950 text-neutral-100 flex overflow-hidden font-sans">

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden"
        onChange={e => stageFiles(e.target.files, 'pdf')}/>
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
        onChange={e => stageFiles(e.target.files, 'ocr')}/>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-neutral-800 bg-neutral-900/60 h-full overflow-hidden">
        <SidebarContent/>
      </aside>

      {/* ── Mobile sidebar overlay ────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}/>
          <aside className="relative w-72 max-w-[85vw] flex flex-col bg-neutral-900 border-r border-neutral-800 h-full overflow-hidden z-10">
            <SidebarContent/>
          </aside>
        </div>
      )}

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Sticky header */}
        <header className="flex-shrink-0 h-14 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 flex items-center px-3 sm:px-4 gap-2 z-10">
          {/* Hamburger (mobile only) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all flex-shrink-0"
          >
            {Icon.menu('w-5 h-5')}
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            {currentSession ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
                <span className="text-sm font-medium text-neutral-200 truncate">{currentSession.title}</span>
                <span className="text-xs text-neutral-700 flex-shrink-0 hidden sm:block">
                  · {uploadedDocs.length} file{uploadedDocs.length !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Study with Aguila
              </span>
            )}
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {currentSession && mode === 'chat' && (
              <button
                onClick={() => setMode('quiz')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-indigo-500/50 hover:text-indigo-300 transition-all"
              >
                {Icon.quiz('w-3.5 h-3.5')}
                <span className="hidden sm:block">Quiz</span>
              </button>
            )}
            {mode === 'quiz' && (
              <button
                onClick={() => setMode('chat')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-indigo-600 text-white border-indigo-500 transition-all"
              >
                {Icon.history('w-3.5 h-3.5')}
                <span className="hidden sm:block">Chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Pomodoro (collapsible) */}
        {showPomodoro && (
          <div className="flex-shrink-0 px-3 sm:px-4 pt-3 max-w-2xl w-full mx-auto">
            <PomodoroTimer userId={user.id} sessionId={currentSession?.id}/>
          </div>
        )}

        {/* ── Quiz mode ────────────────────────────────────────────── */}
        {mode === 'quiz' && (
          <div className="flex-1 overflow-hidden px-3 sm:px-4 py-3 max-w-3xl w-full mx-auto">
            <div className="h-full bg-neutral-900/50 rounded-2xl border border-neutral-800 overflow-hidden">
              {quizQuestions ? (
                <QuizMode
                  key={quizKey}
                  questions={quizQuestions}
                  onFinish={() => { setMode('chat'); setAutoQuizReady(null); setMascotMood('celebrating') }}
                  onRetake={() => setQuizKey(k => k + 1)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-5">
                  <AguiMascot mood="studying" size="md" showBubble={false}/>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Ready to test yourself?</h3>
                    <p className="text-neutral-500 text-sm">Generate a quiz from your uploaded notes</p>
                  </div>
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz || !uploadedDocs.length}
                    className="bg-indigo-600 text-white px-7 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2 transition-all"
                  >
                    {isGeneratingQuiz
                      ? <>{Icon.spinner('w-4 h-4')} Generating...</>
                      : <>{Icon.quiz('w-4 h-4')} Start quiz</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Chat mode ────────────────────────────────────────────── */}
        {mode === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 max-w-3xl w-full mx-auto px-3 sm:px-4 pb-3 pt-2">

            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}
            >

              {/* ── Welcome / empty state ─────────────────────────── */}
              {!currentSession && (
                <div className="flex flex-col items-center justify-center min-h-full py-8 px-4 text-center">
                  <AguiMascot mood={mascotMood} size="lg" showBubble={true}/>

                  <h2 className="text-2xl font-bold text-white mt-6 mb-1">
                    {getGreeting()}{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                  </h2>
                  <p className="text-neutral-500 text-sm mb-8">
                    Upload your notes and Agui will turn them into a full study experience.
                  </p>

                  {/* Quick action cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mb-8">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-start gap-3 p-4 bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 rounded-2xl text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                        {Icon.upload('w-4 h-4 text-indigo-400')}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Upload PDF notes</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Quiz generated automatically</p>
                      </div>
                    </button>

                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-start gap-3 p-4 bg-neutral-900 border border-neutral-800 hover:border-teal-500/50 rounded-2xl text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/20 transition-colors">
                        <ScanIcon cls="w-4 h-4 text-teal-400"/>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Scan handwritten notes</p>
                        <p className="text-xs text-neutral-500 mt-0.5">OCR reads your handwriting</p>
                      </div>
                    </button>
                  </div>

                  {/* Recent sessions */}
                  {sessions.length > 0 && (
                    <div className="w-full max-w-md">
                      <p className="text-xs text-neutral-700 uppercase tracking-widest font-medium mb-3">Recent sessions</p>
                      <div className="space-y-1.5">
                        {sessions.slice(0, 4).map(s => (
                          <button
                            key={s.id}
                            onClick={() => loadSession(s)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-900 border border-neutral-800 hover:border-indigo-500/40 rounded-xl transition-all group text-left"
                          >
                            {Icon.file('w-4 h-4 text-neutral-600 group-hover:text-indigo-400 flex-shrink-0 transition-colors')}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-neutral-300 group-hover:text-white truncate transition-colors">{s.title}</p>
                              <p className="text-xs text-neutral-700">{s.session_documents?.length || 0} file{s.session_documents?.length !== 1 ? 's' : ''}</p>
                            </div>
                            <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Open →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Loading history ─────────────────────────────────── */}
              {currentSession && loadingHistory && (
                <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
                  {Icon.spinner('w-5 h-5')} Loading conversation...
                </div>
              )}

              {/* ── Messages ────────────────────────────────────────── */}
              {currentSession && !loadingHistory && messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} min-w-0`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 self-end">
                      <EagleLogo className="w-4 h-4"/>
                    </div>
                  )}
                  <div className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words min-w-0 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-neutral-800 text-neutral-200 rounded-bl-sm border border-neutral-700/70'
                  }`}>
                    {msg.role === 'user' ? (
                      msg.content.split('\n').map((l, j) => <span key={j}>{l}<br/></span>)
                    ) : (
                      <div className="overflow-x-hidden break-words prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0" {...props}/>,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2.5 space-y-1" {...props}/>,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2.5 space-y-1" {...props}/>,
                            li: ({ node, ...props }) => <li className="text-neutral-300" {...props}/>,
                            strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props}/>,
                            code: ({ node, ...props }) => <code className="bg-neutral-700 rounded px-1 py-0.5 text-xs text-indigo-300" {...props}/>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <EagleLogo className="w-4 h-4"/>
                  </div>
                  <div className="bg-neutral-800 rounded-2xl rounded-bl-sm px-4 py-3 border border-neutral-700/70 flex gap-1.5 items-center">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef}/>
            </div>

            {/* FAB */}
            {showFAB && (
              <button
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="absolute bottom-32 right-5 sm:right-8 w-9 h-9 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 rounded-full shadow-lg flex items-center justify-center transition-all z-10"
              >
                {Icon.chevronDown('w-4 h-4')}
              </button>
            )}

            {/* ── Sticky input area ────────────────────────────────── */}
            <div className="flex-shrink-0 space-y-2">

              {/* Upload tray (new session staging) */}
              {!currentSession && uploadTray.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-neutral-500 font-medium">Files ready to process</p>
                    <button onClick={() => setUploadTray([])} className="text-xs text-neutral-600 hover:text-neutral-400">
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {uploadTray.map((item, i) => (
                      <div key={i} className="relative">
                        <FilePill name={item.file.name} state={item.state}/>
                        {item.state === 'pending' && (
                          <button
                            onClick={() => removeTrayItem(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-700 rounded-full flex items-center justify-center"
                          >
                            {Icon.x('w-2.5 h-2.5 text-neutral-400')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleStartSession}
                    disabled={isProcessing || uploadTray.every(f => f.state === 'done')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing
                      ? <>{Icon.spinner('w-4 h-4')} Processing files...</>
                      : <>{Icon.upload('w-4 h-4')} Start session</>}
                  </button>
                </div>
              )}

              {/* Extra files tray (adding to existing session) */}
              {currentSession && showExtraInput && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 space-y-2">
                  {extraTray.length === 0 ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const inp = document.createElement('input')
                          inp.type = 'file'; inp.accept = 'application/pdf'; inp.multiple = true
                          inp.onchange = e => setExtraTray(Array.from(e.target.files).map(f => ({ file: f, state: 'pending', type: 'pdf' })))
                          inp.click()
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-neutral-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all"
                      >
                        {Icon.upload('w-3.5 h-3.5')} Add PDF
                      </button>
                      <button
                        onClick={() => {
                          const inp = document.createElement('input')
                          inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.multiple = true
                          inp.onchange = e => setExtraTray(Array.from(e.target.files).map(f => ({ file: f, state: 'pending', type: 'ocr' })))
                          inp.click()
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-neutral-400 hover:text-teal-400 hover:border-teal-500/40 transition-all"
                      >
                        <ScanIcon cls="w-3.5 h-3.5"/> Scan image
                      </button>
                      <button onClick={() => setShowExtraInput(false)} className="px-3 text-neutral-600 hover:text-neutral-400">
                        {Icon.x('w-4 h-4')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {extraTray.map((item, i) => <FilePill key={i} name={item.file.name} state={item.state}/>)}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddExtra}
                          disabled={addingExtra}
                          className="flex-1 py-2 bg-indigo-600 text-white text-xs rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {addingExtra ? <>{Icon.spinner('w-3.5 h-3.5')} Uploading...</> : <>{Icon.check('w-3.5 h-3.5')} Add to session</>}
                        </button>
                        <button onClick={() => { setExtraTray([]); setShowExtraInput(false) }} className="px-3 bg-neutral-800 text-neutral-400 text-xs rounded-xl border border-neutral-700">
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Auto-quiz banner */}
              {currentSession && autoQuizReady && (
                <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {Icon.quiz('w-4 h-4 text-indigo-400 flex-shrink-0')}
                    <span className="text-xs text-indigo-300 font-medium truncate">Auto-quiz ready from your notes</span>
                  </div>
                  <button
                    onClick={handleGenerateQuiz}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium flex-shrink-0 ml-2 transition-all"
                  >
                    Start
                  </button>
                </div>
              )}

              {/* Generate quiz button */}
              {currentSession && !autoQuizReady && mode === 'chat' && (
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className="w-full py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-500 text-xs font-medium hover:border-indigo-500/30 hover:text-indigo-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isGeneratingQuiz
                    ? <>{Icon.spinner('w-3.5 h-3.5')} Generating quiz...</>
                    : <>{Icon.quiz('w-3.5 h-3.5')} Generate quiz from notes</>}
                </button>
              )}

              {/* Main input bar */}
              <div className="flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-2">

                {/* Attach button */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => {
                      if (currentSession) {
                        setShowExtraInput(v => !v)
                      } else {
                        fileInputRef.current?.click()
                      }
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 transition-all"
                    title={currentSession ? 'Add files to session' : 'Upload notes'}
                  >
                    <AttachIcon cls="w-4 h-4"/>
                  </button>
                </div>

                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (currentSession) handleSend()
                    }
                  }}
                  placeholder={currentSession ? 'Ask anything about your notes...' : 'Upload notes above to start a session...'}
                  disabled={!currentSession}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-600 resize-none focus:outline-none py-2 px-1 min-w-0 disabled:opacity-40 max-h-32"
                  style={{ lineHeight: '1.5' }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                  }}
                />

                {/* Send / Cancel */}
                {isTyping ? (
                  <button
                    onClick={handleCancel}
                    className="w-9 h-9 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                    title="Cancel"
                  >
                    {Icon.x('w-4 h-4')}
                  </button>
                ) : (
                  <button
                    onClick={currentSession ? handleSend : () => fileInputRef.current?.click()}
                    disabled={currentSession ? !input.trim() : false}
                    className="w-9 h-9 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center flex-shrink-0"
                  >
                    {currentSession ? Icon.send('w-4 h-4') : Icon.upload('w-4 h-4')}
                  </button>
                )}
              </div>

              {/* Hint text */}
              {!currentSession && uploadTray.length === 0 && (
                <p className="text-xs text-neutral-700 text-center">
                  Press Enter to send &middot; Shift+Enter for new line
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}