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
import mermaid from 'mermaid'

// ── Inline SVG logo ───────────────────────────────────────────────────
const EagleLogo = ({ className = 'w-6 h-6' }) => (
  <img 
    src="/logo.png" 
    alt="Study with Aguila Logo" 
    className={`${className} object-contain rounded-full shadow-sm`}
    style={{ imageRendering: 'pixelated' }} 
  />
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

// ── 🌟 NEW: Users / Lounge icon ──────────────────────────────────────
// ── 🌟 UPDATED: Users / Lounge icon (Fixed sizing) ───────────────────
const UsersIcon = (cls = '') => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
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

// 🌟 SMART Mermaid renderer: Only renders when the graph is valid!
const MermaidDiagram = ({ chart }) => {
  const [svg, setSvg] = useState('')
  const [isValid, setIsValid] = useState(false)
  
  useEffect(() => {
    const renderChart = async () => {
      // 1. Basic check: Mermaid must start with a valid diagram keyword (graph, pie, etc.)
      const validTypes = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'mindmap', 'timeline'];
      const firstWord = chart.trim().split(/\s+/)[0];
      
      if (!validTypes.includes(firstWord)) {
        setIsValid(false);
        return;
      }

      try {
        mermaid.initialize({ theme: 'dark', startOnLoad: false, securityLevel: 'loose' })
        
        // 2. 🛡️ SILENT PARSE: Check syntax without rendering. 
        // If this throws, it stays in "typing" mode.
        await mermaid.parse(chart)
        
        // 3. If parsing passes, render the actual SVG
        const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart)
        setSvg(svg)
        setIsValid(true)
      } catch (err) {
        // Still typing or invalid syntax — hide the error bombs!
        setIsValid(false)
      }
    }
    
    if (chart.trim()) renderChart()
  }, [chart])

  // While typing or invalid: Show a cool "Matrix-style" code box
  if (!isValid || !svg) {
    return (
      <div className="my-4 bg-neutral-900 border border-neutral-800 p-4 rounded-xl font-mono text-[10px] text-indigo-400/80 whitespace-pre-wrap border-l-4 border-l-indigo-500/50">
        <div className="flex items-center gap-2 mb-2 text-neutral-500 uppercase tracking-widest text-[9px] font-bold">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Building Visual...
        </div>
        {chart}
        <span className="animate-pulse text-indigo-500 font-bold ml-0.5">_</span>
      </div>
    )
  }

  // Once valid: Show the beautiful chart!
  return (
    <div 
      className="my-4 bg-neutral-900/50 p-4 rounded-xl border border-neutral-700 flex justify-center overflow-x-auto animate-fade-in-up"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  )
}

const MarkdownRenderer = ({ content }) => (
  <div className="overflow-x-hidden break-words prose prose-invert prose-sm max-w-none">
    <ReactMarkdown
      components={{
        p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0" {...props}/>,
        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2.5 space-y-1" {...props}/>,
        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2.5 space-y-1" {...props}/>,
        li: ({ node, ...props }) => <li className="text-neutral-300" {...props}/>,
        strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props}/>,
        code: ({ inline, className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          if (!inline && match && match[1] === 'mermaid') {
            return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
          }
          return <code className={`${className || ''} bg-neutral-700 rounded px-1.5 py-0.5 text-xs text-indigo-300`} {...props}>{children}</code>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
)

// 🌟 2. The Typewriter Engine
const TypewriterMarkdown = ({ content }) => {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i += 5 // 🌟 Faster typing jump
      setDisplayed(content.slice(0, i))
      if (i >= content.length) clearInterval(timer)
    }, 15)
    return () => clearInterval(timer)
  }, [content])

  return <MarkdownRenderer content={displayed} />
}

// ── Main component ───────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()

  // Auth
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)

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
  const [quizId, setQuizId] = useState(null)

  // Mascot
  const [mascotMood, setMascotMood] = useState('idle')

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true)
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
      
      // 🌟 Check if they have a saved name
      const savedName = session.user.user_metadata?.display_name
      
      if (savedName) {
        setDisplayName(savedName)
      } else {
        // 🌟 FIRST TIME USER: Default to email prefix, but immediately open the editor!
        setDisplayName(session.user.email.split('@')[0])
        setIsEditingName(true)
      }
      
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
        // 🌟 UPDATED: Now stores both questions and the quizId!
        setAutoQuizReady({ questions: quizResult.questions, quizId: quizResult.quizId })
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

const handleSend = async (e) => {
    e?.preventDefault()
    const msg = input.trim()
    if (!msg || isTyping) return

    cancelRef.current = false
    setInput('')
    
    // 🌟 NEW: Auto-create a session if they are just chatting generally!
    let activeSessionId = currentSession?.id
    if (!activeSessionId) {
      // Create a session named after their first message
      const sessionResult = await createSession(user.id, msg.substring(0, 30) + '...')
      if (sessionResult.success) {
        activeSessionId = sessionResult.session.id
        setCurrentSession(sessionResult.session)
        setUploadedDocs([]) // No PDFs for this session!
        await refreshSessions()
      } else {
        return // Stop if session creation fails
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setIsTyping(true)
    setMascotMood('thinking')

    // 🌟 FIX: Use the activeSessionId we just grabbed/created
    const result = await askDocument(msg, activeSessionId, user.id)

    if (cancelRef.current) { setIsTyping(false); setMascotMood('idle'); return }
    setIsTyping(false)
    setMascotMood('idle')

    if (result.success) {
      if (result.quizTrigger) {
        setMessages(prev => [...prev, { role: 'ai', content: result.answer, isNew: true }])
        setIsGeneratingQuiz(true)
        const qr = await generateQuiz(uploadedDocs[0], user.id, result.quizTrigger, activeSessionId)
        setIsGeneratingQuiz(false)
        if (qr.success) { setQuizQuestions(qr.questions); setQuizId(qr.quizId); setMode('quiz') }
        return
      }
      setMessages(prev => [...prev, { role: 'ai', content: result.answer, isNew: true }])
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
    if (autoQuizReady) {
      setQuizQuestions(autoQuizReady.questions)
      setQuizId(autoQuizReady.quizId)
      setMode('quiz')
      return
    }
    
    setIsGeneratingQuiz(true)
    
    // 🌟 SMART CONTEXT: If no docs are uploaded, bundle the last 10 chat messages together!
    let chatContext = null;
    if (!uploadedDocs.length) {
      chatContext = messages.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    }

    // Pass the first doc ID (if it exists), or pass the chatContext!
    const docToPass = uploadedDocs.length > 0 ? uploadedDocs[0] : null;
    const result = await generateQuiz(docToPass, user.id, 5, currentSession?.id, chatContext)
    
    setIsGeneratingQuiz(false)
    if (result.success) {
      setQuizQuestions(result.questions)
      setQuizId(result.quizId)
      setMode('quiz')
    } else {
      setMessages(prev => [...prev, { role: 'ai', content: `Failed to generate quiz: ${result.error}`, isNew: true }])
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSaveName = async () => {
    setIsEditingName(false)
    if (!displayName.trim()) return
    await supabase.auth.updateUser({
      data: { display_name: displayName.trim() }
    })
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
      {/* Logo and Close Buttons */}
      <div className="flex-shrink-0 px-4 border-b border-neutral-800 flex items-center justify-between h-14">
        <div className="flex items-center gap-2.5">
          <EagleLogo className="w-6 h-6"/>
          <span className="font-bold text-white text-sm leading-tight">Menu</span>
        </div>
        
        {/* 🌟 Unified Toggle Close (Desktop & Mobile) */}
        <button
          onClick={() => { setSidebarOpen(false); setIsDesktopSidebarOpen(false); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          {/* Cool panel-close icon for BOTH devices */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
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
      <div className="flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
          { label: 'Student Lounge', icon: UsersIcon, href: '/lounge' },
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
      
      {/* 1. Document Input (PDF & DOCX) */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
        multiple 
        className="hidden"
        onChange={e => stageFiles(e.target.files, 'pdf')}
      />
      
      {/* 2. 🌟 RESTORED: OCR Image Input */}
      <input 
        ref={imageInputRef} 
        type="file" 
        accept="image/jpeg,image/png,image/webp" 
        multiple 
        className="hidden"
        onChange={e => stageFiles(e.target.files, 'ocr')}
      />

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      {/* 🌟 FIX: Removed the {isDesktopSidebarOpen &&} wrapper so it can animate! */}
      <aside 
        className={`hidden md:flex flex-col flex-shrink-0 border-neutral-800 bg-neutral-900/60 h-full transition-all duration-300 ease-in-out overflow-hidden ${
          isDesktopSidebarOpen ? 'w-60 border-r opacity-100' : 'w-0 border-r-0 opacity-0'
        }`}
      >
        <div className="w-60 h-full flex flex-col">
          <SidebarContent/>
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ────────────────────────────────── */}
      {/* 🌟 FIX: Removed the {sidebarOpen &&} wrapper so it can animate! */}
      <div className={`fixed inset-0 z-50 flex md:hidden transition-all duration-300 ${sidebarOpen ? 'visible' : 'invisible pointer-events-none'}`}>
        <div 
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setSidebarOpen(false)}
        />
        <aside 
          className={`relative w-72 max-w-[85vw] flex flex-col bg-neutral-900 border-r border-neutral-800 h-full overflow-hidden z-10 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="w-72 max-w-[85vw] h-full flex flex-col">
            <SidebarContent/>
          </div>
        </aside>
      </div>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Sticky header */}
        <header className="flex-shrink-0 h-14 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 flex items-center px-3 sm:px-4 gap-2 z-10">
          {/* 🌟 Unified Hamburger Button (Mobile + Desktop) */}
          <button
            onClick={() => { setSidebarOpen(true); setIsDesktopSidebarOpen(true); }}
            className={`w-9 h-9 items-center justify-center rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all flex-shrink-0 mr-1 ${
              isDesktopSidebarOpen ? 'flex md:hidden' : 'flex'
            }`}
          >
            {/* Panel-open icon for BOTH devices */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
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
                  quizId={quizId}
                  userId={user?.id}
                  onFinish={() => { setMode('chat'); setAutoQuizReady(null); setMascotMood('celebrating') }}
                  onRetake={async () => {
                    setIsGeneratingQuiz(true)
                    const result = await generateQuiz(uploadedDocs[0], user.id, 5, currentSession?.id)
                    setIsGeneratingQuiz(false)
                    if (result.success) {
                      setQuizQuestions(result.questions)
                      setQuizId(result.quizId)
                      setQuizKey(k => k + 1)
                    }
                  }}
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

                  {/* 🌟 Editable Greeting */}
                  <div className="flex items-center justify-center gap-2 mt-6 mb-1">
                    <h2 className="text-2xl font-bold text-white">
                      {getGreeting()},
                    </h2>
                    
                    {isEditingName ? (
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                        autoFocus
                        onFocus={(e) => e.target.select()} /* 🌟 NEW: Auto-highlights the text! */
                        className="bg-neutral-800 text-white text-2xl font-bold rounded-lg px-2 py-0.5 outline-none w-40 border border-indigo-500 focus:ring-2 focus:ring-indigo-500 text-center"
                      />
                    ) : (
                      <div 
                        onClick={() => setIsEditingName(true)}
                        className="flex items-center gap-2 group cursor-pointer hover:bg-neutral-800/50 px-2 py-0.5 rounded-lg transition-colors"
                        title="Click to change your name"
                      >
                        <h2 className="text-2xl font-bold text-white">
                          {displayName}
                        </h2>
                        {/* Pencil icon */}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-neutral-500 text-sm mb-8">
                    Upload your notes and Agui will turn them into a full study experience.
                  </p>

                 {/* Quick action cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mb-8">
                    
                    {/* 1. Upload PDF Button */}
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

                    {/* 2. Scan Handwritten Notes Button */}
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

                    {/* 3. 🌟 Lounge Banner (Spans 2 columns, sits at the bottom) */}
                    <button
                      onClick={() => router.push('/lounge')}
                      className="sm:col-span-2 flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/30 transition-colors">
                          {UsersIcon('w-4 h-4 text-indigo-400')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-indigo-100">Enter Student Lounge</p>
                          <p className="text-xs text-indigo-300/70 mt-0.5">Study with friends in a virtual voice room</p>
                        </div>
                      </div>
                      <span className="text-indigo-400 text-xs font-semibold mr-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">Join →</span>
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
                  /* 🌟 Added animate-fade-in-up class for smooth rendering! */
                  className={`flex items-end gap-2 animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'} min-w-0`}
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
                      /* 🌟 If it's a new message, type it out. Otherwise, render it instantly! */
                      msg.isNew ? (
                        <TypewriterMarkdown content={msg.content} />
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )
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

              {/* 🌟 Generate quiz button (Visible if there are notes OR if they have chatted enough) */}
              {currentSession && !autoQuizReady && mode === 'chat' && (uploadedDocs.length > 0 || messages.length > 2) && (
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className="w-full py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-500 text-xs font-medium hover:border-indigo-500/30 hover:text-indigo-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isGeneratingQuiz
                    ? <>{Icon.spinner('w-3.5 h-3.5')} Generating quiz...</>
                    : <>{Icon.quiz('w-3.5 h-3.5')} {uploadedDocs.length > 0 ? 'Generate quiz from notes' : 'Generate quiz from chat'}</>}
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
                      handleSend() /* 🌟 Removed the 'if (currentSession)' check */
                    }
                  }}
                  /* 🌟 Updated Placeholder */
                  placeholder="Ask anything, or upload notes to start a study session..."
                  /* 🌟 Removed disabled={!currentSession} */
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-600 resize-none focus:outline-none py-2 px-1 min-w-0 max-h-32"
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
                    /* 🌟 Changed onClick to always allow sending OR opening files if empty */
                    onClick={input.trim() ? handleSend : () => fileInputRef.current?.click()}
                    className="w-9 h-9 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center flex-shrink-0"
                  >
                    {input.trim() ? Icon.send('w-4 h-4') : Icon.upload('w-4 h-4')}
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