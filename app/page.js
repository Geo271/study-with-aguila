'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { processPDF, createSession } from './actions/pdf'
import { askDocument, getSessions, getArchivedSessions, archiveSession, restoreSession, getSessionMessages } from './actions/chat'
import { generateQuiz } from './actions/quiz'
import QuizMode from '@/components/QuizMode'
import PomodoroTimer from '@/components/PomodoroTimer'
import { Icon } from '@/components/Icons'
import ReactMarkdown from 'react-markdown'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Session
  const [sessions, setSessions] = useState([])
  const [archivedSessions, setArchivedSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [status, setStatus] = useState('idle')

  // Upload
  const [files, setFiles] = useState([])
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [uploadProgress, setUploadProgress] = useState([])
  const [extraFiles, setExtraFiles] = useState([])
  const [extraProgress, setExtraProgress] = useState([])
  const [addingPDF, setAddingPDF] = useState(false)

  // Chat
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const inputRef = useRef(null)

  // Quiz
  const [mode, setMode] = useState('chat')
  const [quizQuestions, setQuizQuestions] = useState(null)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [quizKey, setQuizKey] = useState(0)
  const [autoQuizReady, setAutoQuizReady] = useState(null)

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [historyTab, setHistoryTab] = useState('active')
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showFAB, setShowFAB] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setAuthLoading(false)
      await refreshSessions(session.user.id)
    }
    checkAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e, session) => {
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [router])

useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const handleScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      setShowFAB(distFromBottom > 200)
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  // 🌟 FIX 1: Added 'mode' here so it re-attaches when you close a quiz!
  }, [status, mode])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const handleScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      setShowFAB(distFromBottom > 200)
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [status])

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    if (!showFAB) scrollToBottom()
  }, [messages])

  const refreshSessions = async (uid) => {
    const id = uid || user?.id
    if (!id) return
    const [a, b] = await Promise.all([getSessions(id), getArchivedSessions(id)])
    if (a.success) setSessions(a.sessions)
    if (b.success) setArchivedSessions(b.sessions)
  }

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).slice(0, 3)
    setFiles(selected)
    setUploadProgress(selected.map(f => ({ name: f.name, state: 'pending' })))
    setAutoQuizReady(null)
  }

  const handleStartSession = async () => {
    if (!files.length) return
    setStatus('uploading')

    const autoTitle = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim()
    const sessionResult = await createSession(user.id, autoTitle)
    if (!sessionResult.success) { setStatus('idle'); return }

    const session = sessionResult.session
    const docIds = []
    let firstExtractedText = ''

    for (let i = 0; i < files.length; i++) {
      setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, state: 'uploading' } : p))
      const formData = new FormData()
      formData.append('file', files[i])
      const result = await processPDF(formData, user.id, session.id)
      setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, state: result.success ? 'done' : 'error' } : p))
      if (result.success) {
        docIds.push(result.documentId)
        if (i === 0) firstExtractedText = result.extractedText || ''
      }
    }

    setCurrentSession(session)
    setUploadedDocs(docIds)
    setStatus('ready')
    setMessages([{
      role: 'ai',
      content: `Session "${autoTitle}" is ready. I have processed ${docIds.length} PDF${docIds.length > 1 ? 's' : ''}. You can ask me questions, request a summary, or I can generate a quiz automatically.`
    }])

    await refreshSessions()
   
  }

  const loadSession = async (session) => {
    setLoadingHistory(true)
    setCurrentSession(session)
    setUploadedDocs(session.session_documents?.map(d => d.document_id) || [])
    setStatus('ready')
    setMode('chat')
    setSidebarOpen(false)
    setQuizQuestions(null)
    setAutoQuizReady(null)

    const result = await getSessionMessages(session.id)
    if (result.success && result.messages.length > 0) {
      setMessages(result.messages.map(m => ({ role: m.role, content: m.content })))
    } else {
      setMessages([{ role: 'ai', content: `Welcome back to "${session.title}". Ask me anything about your notes.` }])
    }
    setLoadingHistory(false)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    const msg = input.trim()
    if (!msg || !currentSession) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setIsTyping(true)

    const result = await askDocument(msg, currentSession.id, user.id)
    setIsTyping(false)

  if (result?.success) {
        const aiResponse = result.answer;

        // 2. 🌟 THE NEW AI COMMAND LISTENER 🌟
        // It ONLY triggers if the AI decided to output the secret code!
        if (aiResponse.includes('[TRIGGER_QUIZ')) {
          const numberMatch = aiResponse.match(/\d+/);
          const aiChosenNumber = numberMatch ? parseInt(numberMatch[0]) : 10;
          
          handleGenerateQuiz(aiChosenNumber);
          return; // Stop here so the secret code doesn't print in the chat
        }
      
      if (triggerMatch) {
        // 🧠 Trust the AI's calculation, but keep a safety net at 15
        let count = parseInt(triggerMatch[1])
        if (count > 15) count = 15; 
        if (count < 1) count = 5;

        setMessages(prev => [...prev, { role: 'ai', content: `Generating a ${count}-question quiz from your notes...` }])
        setIsGeneratingQuiz(true)
        
        const quizResult = await generateQuiz(uploadedDocs[0], user.id, count, currentSession.id)
        setIsGeneratingQuiz(false)
        
        if (quizResult.success) { 
          setQuizQuestions(quizResult.questions); 
          setMode('quiz') 
        } else {
          setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I got confused making the quiz. Please try again!' }])
        }
        return
      }

      // Normal chat response
      setMessages(prev => [...prev, { role: 'ai', content: answer }])
    } else {
      setMessages(prev => [...prev, { role: 'ai', content: 'Something went wrong. Please try again.' }])
    }
  }

  const handleGenerateQuiz = async () => {
    if (autoQuizReady) { setQuizQuestions(autoQuizReady); setMode('quiz'); return }
    setIsGeneratingQuiz(true)
    const result = await generateQuiz(uploadedDocs[0], user.id, 5, currentSession?.id)
    setIsGeneratingQuiz(false)
    if (result.success) { setQuizQuestions(result.questions); setMode('quiz') }
  }

  const handleAddPDF = async () => {
    if (!extraFiles.length || !currentSession) return
    setAddingPDF(true)
    setExtraProgress(extraFiles.map(f => ({ name: f.name, state: 'uploading' })))
    const newDocs = [...uploadedDocs]
    for (let i = 0; i < extraFiles.length; i++) {
      const fd = new FormData()
      fd.append('file', extraFiles[i])
      const r = await processPDF(fd, user.id, currentSession.id)
      setExtraProgress(prev => prev.map((p, idx) => idx === i ? { ...p, state: r.success ? 'done' : 'error' } : p))
      if (r.success) newDocs.push(r.documentId)
    }
    setUploadedDocs(newDocs)
    setAddingPDF(false)
    setExtraFiles([])
    setExtraProgress([])
    setMessages(prev => [...prev, { role: 'ai', content: `Added ${extraFiles.length} additional PDF${extraFiles.length > 1 ? 's' : ''} to this session.` }])
    await refreshSessions()
  }

  const handleArchive = async (sessionId, e) => {
    e?.stopPropagation()
    await archiveSession(sessionId)
    if (currentSession?.id === sessionId) { setStatus('idle'); setCurrentSession(null); setMessages([]) }
    await refreshSessions()
  }

  const handleRestore = async (sessionId, e) => {
    e?.stopPropagation()
    await restoreSession(sessionId)
    await refreshSessions()
  }

  const handleNewSession = () => {
    setStatus('idle'); setCurrentSession(null); setMessages([])
    setFiles([]); setUploadProgress([]); setExtraFiles([])
    setExtraProgress([]); setQuizQuestions(null); setAutoQuizReady(null); setMode('chat')
    setSidebarOpen(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut(); router.push('/login')
  }

  if (authLoading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      {Icon.spinner('w-6 h-6 text-indigo-400')}
    </div>
  )

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex overflow-hidden font-sans">

      {/* ── SIDEBAR ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSidebarOpen(false)}/>
          <aside className="relative w-72 bg-neutral-900 border-r border-neutral-800 h-full flex flex-col z-10">
            {/* Sidebar header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <span className="font-bold text-white text-sm">Study with Aguila</span>
              <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
                {Icon.x('w-4 h-4')}
              </button>
            </div>

            {/* Nav links */}
            <nav className="p-3 space-y-1">
              {[
                { label: 'New Session', icon: Icon.plus, action: handleNewSession },
                { label: 'Quiz Archive', icon: Icon.archive, href: '/quiz-archive' },
                { label: 'Progress', icon: Icon.chart, href: '/dashboard' },
                { label: 'Focus Timer', icon: Icon.clock, action: () => { setShowPomodoro(p => !p); setSidebarOpen(false) } },
              ].map((item, i) => item.href ? (
                <Link key={i} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-all">
                  {item.icon('w-4 h-4')}
                  {item.label}
                </Link>
              ) : (
                <button key={i} onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-all">
                  {item.icon('w-4 h-4')}
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <div className="flex gap-1 mb-2 mt-3">
                {['active', 'archived'].map(tab => (
                  <button key={tab} onClick={() => setHistoryTab(tab)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${historyTab === tab ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}>
                    {tab} ({tab === 'active' ? sessions.length : archivedSessions.length})
                  </button>
                ))}
              </div>

              {(historyTab === 'active' ? sessions : archivedSessions).length === 0 ? (
                <p className="text-xs text-neutral-600 text-center py-6">No {historyTab} sessions</p>
              ) : (historyTab === 'active' ? sessions : archivedSessions).map(s => (
                <div key={s.id} className="group rounded-xl border border-transparent hover:border-neutral-700 hover:bg-neutral-800 transition-all mb-1">
                  <button onClick={() => historyTab === 'active' ? loadSession(s) : null}
                    className="w-full text-left px-3 py-2.5 flex items-start gap-2">
                    {Icon.file('w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-500')}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-300 group-hover:text-white truncate">{s.title}</p>
                      <p className="text-xs text-neutral-600">{s.session_documents?.length || 0} PDF{s.session_documents?.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                  <div className="px-3 pb-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
                    {historyTab === 'active' ? (
                      <button onClick={(e) => handleArchive(s.id, e)}
                        className="text-xs text-neutral-500 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-all flex items-center gap-1">
                        {Icon.archive('w-3 h-3')} Archive
                      </button>
                    ) : (
                      <button onClick={(e) => handleRestore(s.id, e)}
                        className="text-xs text-neutral-500 hover:text-green-400 px-2 py-1 rounded-lg hover:bg-green-500/10 transition-all flex items-center gap-1">
                        {Icon.refresh('w-3 h-3')} Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* User + logout */}
            <div className="p-3 border-t border-neutral-800">
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{user?.email?.[0]?.toUpperCase()}</span>
                </div>
                <span className="text-xs text-neutral-400 truncate flex-1">{user?.email}</span>
                <button onClick={handleLogout} className="text-neutral-500 hover:text-red-400 transition-colors">
                  {Icon.logout('w-4 h-4')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* STICKY HEADER */}
        <header className="flex-shrink-0 h-14 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 flex items-center px-4 gap-3 z-10">
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all flex-shrink-0">
            {Icon.menu('w-5 h-5')}
          </button>

          <div className="flex-1 min-w-0">
            {status === 'ready' && currentSession ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
                <span className="text-sm font-medium text-neutral-200 truncate">{currentSession.title}</span>
                <span className="text-xs text-neutral-600 flex-shrink-0">{uploadedDocs.length} PDF{uploadedDocs.length !== 1 ? 's' : ''}</span>
              </div>
            ) : (
              <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Study with Aguila
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'ready' && (
              <button onClick={() => setMode(mode === 'quiz' ? 'chat' : 'quiz')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  mode === 'quiz' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-indigo-500/50'
                }`}>
                {Icon.quiz('w-3.5 h-3.5')}
                {mode === 'quiz' ? 'Chat' : 'Quiz'}
              </button>
            )}
          </div>
        </header>

       {/* 🌟 NEW: Side-by-Side Layout Container */}
        <div className="flex-1 flex flex-col md:flex-row max-w-[1400px] w-full mx-auto px-4 pb-4 pt-3 gap-6 overflow-hidden relative">

        {/* CONTENT AREA */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 max-w-4xl mx-auto w-full">

          {/* ── IDLE / UPLOAD ── */}
         {['idle', 'uploading'].includes(status) && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      {Icon.eagle('w-8 h-8 text-indigo-400')}
                    </div>
                    <h2 className="text-xl font-bold text-white">Start a study session</h2>
                    <p className="text-neutral-500 text-sm mt-1">Upload up to 3 PDF notes — quiz generated automatically</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block w-full border-2 border-dashed border-neutral-700 rounded-xl p-6 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group text-center">
                      {Icon.upload('w-6 h-6 mx-auto mb-2 text-neutral-500 group-hover:text-indigo-400 transition-colors')}
                      <p className="text-sm text-neutral-400 group-hover:text-neutral-300">
                        {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Click to choose PDF files'}
                      </p>
                      <input type="file" accept="application/pdf" multiple onChange={handleFileChange} className="hidden"/>
                    </label>

                    {files.length > 0 && (
                      <div className="space-y-1.5">
                        {uploadProgress.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 bg-neutral-800 px-3 py-2 rounded-lg border border-neutral-700">
                            {f.state === 'done' ? Icon.check('w-4 h-4 text-green-400 flex-shrink-0') :
                             f.state === 'error' ? Icon.x('w-4 h-4 text-red-400 flex-shrink-0') :
                             f.state === 'uploading' ? Icon.spinner('w-4 h-4 text-indigo-400 flex-shrink-0') :
                             Icon.file('w-4 h-4 text-neutral-500 flex-shrink-0')}
                            <span className="text-xs text-neutral-300 truncate flex-1">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button onClick={handleStartSession}
                      disabled={!files.length || status === 'uploading'}
                      className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-sm">
                      {status === 'uploading'
                        ? <>{Icon.spinner('w-4 h-4')} Processing PDFs...</>
                        : <>{Icon.upload('w-4 h-4')} Start Studying</>}
                    </button>
                  </div>

                  {sessions.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-neutral-800">
                      <p className="text-xs text-neutral-600 font-medium uppercase tracking-widest mb-3">Continue a session</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {sessions.map(s => (
                          <button key={s.id} onClick={() => loadSession(s)}
                            className="w-full text-left px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-indigo-500/40 rounded-xl transition-all group flex items-center gap-3">
                            {Icon.file('w-4 h-4 text-neutral-500 flex-shrink-0')}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-neutral-300 group-hover:text-white truncate">{s.title}</p>
                              <p className="text-xs text-neutral-600">{s.session_documents?.length || 0} PDF{s.session_documents?.length !== 1 ? 's' : ''}</p>
                            </div>
                            <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Open</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* ── CHAT MODE ── */}
          {status === 'ready' && mode === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900/40 rounded-2xl border border-neutral-800 relative">
              
              {/* 🌟 SCROLLBAR FIX: Added tailwind classes to hide scrollbar but keep scrolling functionality */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
                    {Icon.spinner('w-5 h-5')} Loading conversation...
                  </div>
                ) : messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'ai' && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                        {Icon.eagle('w-4 h-4 text-indigo-400')}
                      </div>
                    )}
                    
                    
                    <div className={`max-w-[85%] text-[15px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-neutral-800/80 text-neutral-200 px-5 py-3 rounded-3xl rounded-tr-sm shadow-sm'
                        : 'text-neutral-200 px-1 py-1' 
                    }`}>
                      {msg.role === 'user' ? (
                         msg.content.split('\n').map((line, j) => <span key={j}>{line}<br/></span>)
                      ) : (
                         /* 🌟 FIX: We added this div and removed className from ReactMarkdown below */
                         <div className="break-words">
                           <ReactMarkdown 
                             components={{
                               p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                               ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                               ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                               li: ({node, ...props}) => <li className="text-neutral-300" {...props} />,
                               strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                             }}
                           >
                             {msg.content}
                           </ReactMarkdown>
                         </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-end gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                      {Icon.eagle('w-4 h-4 text-indigo-400')}
                    </div>
                    <div className="bg-neutral-800 rounded-2xl rounded-bl-sm px-4 py-3 border border-neutral-700 flex gap-1.5">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef}/>
              </div>

              {/* FAB scroll button */}
              {showFAB && (
                <button onClick={scrollToBottom}
                  /* 🌟 FIX 3: Shifted it up slightly (bottom-32) and added z-10 so it hovers above everything */
                  className="absolute bottom-32 right-8 z-10 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all">
                  {Icon.chevronDown('w-5 h-5')}
                </button>
              )}

             {/* STICKY BOTTOM INPUT AREA */}
              <div className="flex-shrink-0 bg-neutral-900 border-t border-neutral-800 rounded-b-2xl px-4 py-3 space-y-2">

                {/* Auto quiz banner */}
                {autoQuizReady && (
                  <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {Icon.quiz('w-4 h-4 text-indigo-400')}
                      <span className="text-xs text-indigo-300 font-medium">Auto-quiz ready from your notes</span>
                    </div>
                    <button onClick={handleGenerateQuiz}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-all font-medium">
                      Start Quiz
                    </button>
                  </div>
                )}

                {/* Add more PDFs */}
                {extraFiles.length === 0 ? (
                  <label className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-indigo-400 cursor-pointer transition-colors w-fit">
                    {Icon.plus('w-3 h-3')}
                    <span>Add more PDFs to this session</span>
                    <input type="file" accept="application/pdf" multiple
                      onChange={e => {
                        const f = Array.from(e.target.files).slice(0, 3)
                        setExtraFiles(f); setExtraProgress(f.map(x => ({ name: x.name, state: 'pending' })))
                      }} className="hidden"/>
                  </label>
                ) : (
                  <div className="space-y-1.5">
                    {extraProgress.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-neutral-800 px-3 py-1.5 rounded-lg text-xs border border-neutral-700">
                        {f.state === 'done' ? Icon.check('w-3 h-3 text-green-400') :
                         f.state === 'error' ? Icon.x('w-3 h-3 text-red-400') :
                         Icon.spinner('w-3 h-3 text-indigo-400')}
                        <span className="truncate flex-1 text-neutral-400">{f.name}</span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={handleAddPDF} disabled={addingPDF}
                        className="flex-1 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1">
                        {addingPDF ? Icon.spinner('w-3 h-3') : Icon.check('w-3 h-3')}
                        {addingPDF ? 'Uploading...' : 'Add to session'}
                      </button>
                      <button onClick={() => { setExtraFiles([]); setExtraProgress([]) }}
                        className="px-3 py-1.5 bg-neutral-800 text-neutral-400 text-xs rounded-lg border border-neutral-700 hover:bg-neutral-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Generate quiz button */}
                {!autoQuizReady && (
                  <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}
                    className="w-full py-2 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-300 text-xs font-medium hover:border-indigo-500/40 hover:text-indigo-300 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {isGeneratingQuiz
                      ? <>{Icon.spinner('w-3.5 h-3.5')} Generating quiz...</>
                      : <>{Icon.quiz('w-3.5 h-3.5')} Generate Quiz from Notes</>}
                  </button>
                )}

                {/* Message input */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                    placeholder="Ask anything about your notes..."
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                  <button type="submit" disabled={!input.trim() || isTyping}
                    className="w-10 h-10 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center flex-shrink-0">
                    {Icon.send('w-4 h-4')}
                  </button>
                </form>
              </div>
            </div>
          )}

         {/* ── QUIZ MODE ── */}
          {status === 'ready' && mode === 'quiz' && (
            <div className="flex-1 overflow-hidden bg-neutral-900/40 rounded-2xl border border-neutral-800 min-h-[500px]">
              {quizQuestions ? (
                <QuizMode key={quizKey} questions={quizQuestions}
                  onFinish={() => { setMode('chat'); setAutoQuizReady(null) }}
                  onRetake={() => setQuizKey(k => k + 1)}/>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  {Icon.quiz('w-12 h-12 mx-auto mb-4 text-indigo-400')}
                  <h3 className="text-lg font-bold text-white mb-2">Ready to test yourself?</h3>
                  <p className="text-neutral-500 text-sm mb-6">Generate a quiz from your uploaded notes</p>
                  <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}
                    className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2">
                    {isGeneratingQuiz ? <>{Icon.spinner('w-4 h-4')} Generating...</> : <>{Icon.quiz('w-4 h-4')} Start Quiz</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div> {/* 🌟 CRITICAL FIX: This closes the LEFT side so Pomodoro can sit on the right! */}

        {/* ── RIGHT SIDE: POMODORO ── */}
        {showPomodoro && (
          <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <PomodoroTimer userId={user.id} sessionId={currentSession?.id}/>
          </div>
        )}

        </div>
      </div>
    </div>
  )
}