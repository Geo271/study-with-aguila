'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { processPDF, createSession } from './actions/pdf'
import {
  askDocument, getSessions, archiveSession,
  getArchivedSessions, restoreSession, getSessionMessages
} from './actions/chat'
import { generateQuiz } from './actions/quiz'
import QuizMode from '@/components/QuizMode'
import PomodoroTimer from '@/components/PomodoroTimer'
import ReactMarkdown from 'react-markdown'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [sessions, setSessions] = useState([])
  const [archivedSessions, setArchivedSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [status, setStatus] = useState('idle')

  const [files, setFiles] = useState([])
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [uploadProgress, setUploadProgress] = useState([])

  // Add PDF to existing session
  const [addingPDF, setAddingPDF] = useState(false)
  const [extraFiles, setExtraFiles] = useState([])
  const [extraProgress, setExtraProgress] = useState([])

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const [mode, setMode] = useState('chat')
  const [quizQuestions, setQuizQuestions] = useState(null)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [quizKey, setQuizKey] = useState(0)

  const [showHistory, setShowHistory] = useState(false)
  const [historyTab, setHistoryTab] = useState('active') // 'active' | 'archived'
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const refreshSessions = async (uid) => {
    const userId = uid || user?.id
    if (!userId) return
    const [active, archived] = await Promise.all([
      getSessions(userId),
      getArchivedSessions(userId)
    ])
    if (active.success) setSessions(active.sessions)
    if (archived.success) setArchivedSessions(archived.sessions)
  }

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).slice(0, 3)
    setFiles(selected)
    setUploadProgress(selected.map(f => ({ name: f.name, state: 'pending' })))
  }

  const handleStartSession = async () => {
    if (files.length === 0) return
    setStatus('uploading')

    const autoTitle = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim()
    const sessionResult = await createSession(user.id, autoTitle)
    if (!sessionResult.success) { setStatus('idle'); return }

    const session = sessionResult.session
    const docIds = []

    for (let i = 0; i < files.length; i++) {
      setUploadProgress(prev => prev.map((p, idx) =>
        idx === i ? { ...p, state: 'uploading' } : p
      ))
      const formData = new FormData()
      formData.append('file', files[i])
      const result = await processPDF(formData, user.id, session.id)
      setUploadProgress(prev => prev.map((p, idx) =>
        idx === i ? { ...p, state: result.success ? 'done' : 'error' } : p
      ))
      if (result.success) docIds.push(result.documentId)
    }

    setCurrentSession(session)
    setUploadedDocs(docIds)
    setStatus('ready')
    setMessages([{
      role: 'ai',
      content: `Session **"${autoTitle}"** is ready! Processed ${docIds.length} PDF${docIds.length > 1 ? 's' : ''}. Ask me anything or generate a quiz! 🎯`
    }])
    await refreshSessions()
  }

 const loadSession = async (session) => {
    setLoadingHistory(true)
    setCurrentSession(session)
    setUploadedDocs(session.session_documents?.map(d => d.document_id) || [])
    setStatus('ready')
    setMode('chat')
    setShowHistory(false)
    setQuizQuestions(null)

    const result = await getSessionMessages(session.id)
    if (result.success && result.messages.length > 0) {
      setMessages(result.messages.map(m => ({ role: m.role, content: m.content })))
    } else {
      setMessages([{
        role: 'ai',
        content: `Welcome back to **"${session.title}"**! Ask me anything about your notes.`
      }])
    }
    setLoadingHistory(false)
  }

  const handleAddPDF = async () => {
    if (extraFiles.length === 0 || !currentSession) return
    setAddingPDF(true)
    setExtraProgress(extraFiles.map(f => ({ name: f.name, state: 'uploading' })))

    const newDocIds = [...uploadedDocs]
    for (let i = 0; i < extraFiles.length; i++) {
      const formData = new FormData()
      formData.append('file', extraFiles[i])
      const result = await processPDF(formData, user.id, currentSession.id)
      setExtraProgress(prev => prev.map((p, idx) =>
        idx === i ? { ...p, state: result.success ? 'done' : 'error' } : p
      ))
      if (result.success) newDocIds.push(result.documentId)
    }

    setUploadedDocs(newDocIds)
    setAddingPDF(false)
    setExtraFiles([])
    setMessages(prev => [...prev, {
      role: 'ai',
      content: `✅ Added ${extraFiles.length} new PDF${extraFiles.length > 1 ? 's' : ''} to this session! I can now answer questions from all your notes.`
    }])
    await refreshSessions()
  }

  // 1. Upgraded to accept custom numbers!
 const handleGenerateQuiz = async (num) => {
    // 🛡️ The Fix: If 'num' is a React Event object (from a button click), ignore it and use 5!
    const questionCount = typeof num === 'number' ? num : 5;
    
    setIsGeneratingQuiz(true)
    const result = await generateQuiz(uploadedDocs[0], user.id, questionCount, currentSession?.id)
    setIsGeneratingQuiz(false)
    
    if (result?.success) { 
      setQuizQuestions(result.questions); 
      setMode('quiz') 
    }
  }

  // 2. Upgraded to catch keywords AND prevent the black screen crash!
    const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || !currentSession) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsTyping(true)
    const result = await askDocument(userMsg, currentSession.id, user.id)
    setIsTyping(false)
    setMessages(prev => [...prev, {
      role: 'ai',
      content: result.success ? result.answer : 'Something went wrong. Try again!'
    }])
  }

  const handleArchive = async (sessionId, e) => {
    e?.stopPropagation()
    await archiveSession(sessionId)
    if (currentSession?.id === sessionId) {
      setStatus('idle')
      setCurrentSession(null)
      setMessages([])
      setFiles([])
      setUploadProgress([])
    }
    await refreshSessions()
  }

  const handleRestore = async (sessionId, e) => {
    e?.stopPropagation()
    await restoreSession(sessionId)
    await refreshSessions()
  }

  const handleNewSession = () => {
    setStatus('idle')
    setCurrentSession(null)
    setMessages([])
    setFiles([])
    setUploadProgress([])
    setExtraFiles([])
    setExtraProgress([])
    setQuizQuestions(null)
    setMode('chat')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (authLoading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin"/>
        Loading...
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Study with Aguila 🦅
          </h1>
          <div className="flex items-center gap-2">
            {status === 'ready' && (
              <button onClick={() => setMode(mode === 'quiz' ? 'chat' : 'quiz')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                  mode === 'quiz'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-indigo-500/40'
                }`}>
                {mode === 'quiz' ? '💬 Chat' : '🧪 Quiz'}
              </button>
            )}
            <button onClick={() => setShowPomodoro(!showPomodoro)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                showPomodoro
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-teal-500/40'
              }`}>
              ⏱️ Focus
            </button>
            <button onClick={() => setShowHistory(true)}
              className="text-xs px-3 py-1.5 rounded-lg border bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-indigo-500/40 transition-all font-medium">
              📜 History
            </button>
            <Link href="/dashboard"
              className="text-xs px-3 py-1.5 rounded-lg border bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-indigo-500/40 transition-all font-medium">
              📊 Progress
            </Link>
            <button onClick={handleLogout}
              className="text-xs px-3 py-1.5 rounded-lg border bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-red-400 hover:border-red-500/40 transition-all font-medium">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4">

        {showPomodoro && (
          <PomodoroTimer userId={user.id} sessionId={currentSession?.id} />
        )}

        {/* Upload screen */}
        {(status === 'idle' || status === 'uploading') && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-800 w-full max-w-md">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">📚</div>
                <h2 className="text-2xl font-bold text-white">Start Studying</h2>
                <p className="text-neutral-400 text-sm mt-1">Upload up to 3 PDFs — session is named automatically</p>
              </div>

              <div className="space-y-4">
                <label className="block w-full border-2 border-dashed border-neutral-700 rounded-xl p-6 cursor-pointer hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all group text-center">
                  <div className="text-3xl mb-2">📎</div>
                  <p className="text-sm text-neutral-400 group-hover:text-neutral-300 font-medium">
                    {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Click to choose PDFs'}
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">Up to 3 PDF files</p>
                  <input type="file" accept="application/pdf" multiple onChange={handleFileChange} className="hidden"/>
                </label>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {uploadProgress.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 bg-neutral-800 px-4 py-2.5 rounded-xl border border-neutral-700">
                        <span className="text-base flex-shrink-0">
                          {f.state === 'done' ? '✅' : f.state === 'error' ? '❌' : f.state === 'uploading' ? '⏳' : '📄'}
                        </span>
                        <span className="text-sm text-neutral-300 truncate flex-1">{f.name}</span>
                        {f.state === 'uploading' && (
                          <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0"/>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={handleStartSession}
                  disabled={files.length === 0 || status === 'uploading'}
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                  {status === 'uploading' ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing PDFs...</>
                  ) : '🚀 Start Studying'}
                </button>
              </div>

              {sessions.length > 0 && (
                <div className="mt-6 pt-5 border-t border-neutral-800">
                  <p className="text-xs text-neutral-500 mb-3 font-medium uppercase tracking-wide">Continue a session</p>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {sessions.map(s => (
                      <button key={s.id} onClick={() => loadSession(s)}
                        className="w-full text-left p-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-indigo-500/40 rounded-xl transition-all group flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">{s.title}</p>
                          <p className="text-xs text-neutral-500">{s.session_documents?.length || 0} PDF{s.session_documents?.length !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-indigo-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat mode */}
        {status === 'ready' && mode === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900/50 rounded-2xl border border-neutral-800 min-h-[400px]">
            {/* Session bar */}
            <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-green-400 text-xs">●</span>
                <p className="text-sm font-medium text-neutral-300 truncate">{currentSession?.title}</p>
                <span className="text-neutral-600 text-xs">·</span>
                <p className="text-xs text-neutral-500">{uploadedDocs.length} PDF{uploadedDocs.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={handleNewSession}
                className="text-xs text-neutral-500 hover:text-indigo-400 transition-colors flex-shrink-0">
                + New session
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12 text-neutral-500 gap-2">
                  <div className="w-4 h-4 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin"/>
                  Loading conversation...
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'ai' && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-base">🦅</div>
                    )}
                   <div className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm leading-relaxed ${
  msg.role === 'user'
    ? 'bg-indigo-600 text-white rounded-br-none'
    : 'bg-neutral-800 text-neutral-200 rounded-bl-none border border-neutral-700'
}`}>
                      {msg.role === 'user' ? (
                        msg.content.split('\n').map((line, j) => <span key={j}>{line}<br /></span>)
                      ) : (
                        <div className="space-y-3">
                          <ReactMarkdown 
                            components={{
                              p: ({node, ...props}) => <p className="leading-relaxed" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc ml-5 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal ml-5 space-y-1" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2 text-white" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold text-indigo-300" {...props} />
                            }}
                          >
                            {msg.content || ' '}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="flex items-end gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-base">🦅</div>
                  <div className="bg-neutral-800 rounded-2xl rounded-bl-none px-4 py-3 border border-neutral-700 flex gap-1.5">
                    {[0, 75, 150].map(d => (
                      <div key={d} className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* 🌟 STICKY BOTTOM — combined add PDF + quiz button + input 🌟 */}
            <div className="sticky bottom-0 bg-neutral-900/95 backdrop-blur border-t border-neutral-800 rounded-b-2xl px-4 py-3 space-y-2">
              {/* Add PDF to session */}
              {extraFiles.length === 0 ? (
                <label className="flex items-center gap-2 text-xs text-neutral-500 hover:text-indigo-400 cursor-pointer transition-colors w-fit">
                  <span>➕ Add more PDFs to this session</span>
                  <input type="file" accept="application/pdf" multiple
                    onChange={e => {
                      const f = Array.from(e.target.files).slice(0, 3)
                      setExtraFiles(f)
                      setExtraProgress(f.map(x => ({ name: x.name, state: 'pending' })))
                    }}
                    className="hidden"/>
                </label>
              ) : (
                <div className="space-y-2">
                  {extraProgress.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-neutral-800 px-3 py-2 rounded-lg border border-neutral-700 text-xs">
                      <span>{f.state === 'done' ? '✅' : f.state === 'error' ? '❌' : f.state === 'uploading' ? '⏳' : '📄'}</span>
                      <span className="truncate flex-1 text-neutral-300">{f.name}</span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={handleAddPDF} disabled={addingPDF}
                      className="flex-1 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {addingPDF ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Uploading...</> : '✅ Add to session'}
                    </button>
                    <button onClick={() => { setExtraFiles([]); setExtraProgress([]) }}
                      className="px-3 py-2 bg-neutral-800 text-neutral-400 text-xs rounded-lg hover:bg-neutral-700 border border-neutral-700">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Generate quiz */}
              <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}
                className="w-full py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isGeneratingQuiz
                  ? <><span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"/>Generating quiz...</>
                  : '🧪 Generate Quiz from Notes'}
              </button>

              {/* Message input */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Ask anything about your notes..."
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                <button type="submit" disabled={!input.trim() || isTyping}
                  className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Quiz mode */}
        {status === 'ready' && mode === 'quiz' && (
          <div className="flex-1 overflow-hidden bg-neutral-900/50 rounded-2xl border border-neutral-800 min-h-[500px]">
            {quizQuestions ? (
              <QuizMode key={quizKey} questions={quizQuestions}
                onFinish={() => setMode('chat')}
                onRetake={() => setQuizKey(k => k + 1)}/>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="text-5xl mb-4">🧪</div>
                <h3 className="text-xl font-bold text-white mb-2">Ready to test yourself?</h3>
                <p className="text-neutral-400 text-sm mb-6">Generate a quiz from your uploaded notes</p>
                <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                  {isGeneratingQuiz
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating...</>
                    : '🎯 Start Quiz'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)}/>
          <div className="relative ml-auto w-full max-w-sm bg-neutral-900 border-l border-neutral-800 h-full flex flex-col">

            <div className="p-5 border-b border-neutral-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-white text-lg">Session History</h2>
                <button onClick={() => setShowHistory(false)}
                  className="text-neutral-500 hover:text-white w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">✕</button>
              </div>
              {/* Tabs */}
              <div className="flex bg-neutral-800 rounded-xl p-1 gap-1">
                <button onClick={() => setHistoryTab('active')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                    historyTab === 'active'
                      ? 'bg-indigo-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}>
                  Active ({sessions.length})
                </button>
                <button onClick={() => setHistoryTab('archived')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                    historyTab === 'archived'
                      ? 'bg-amber-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}>
                  Archived ({archivedSessions.length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">

              {/* Active sessions */}
              {historyTab === 'active' && (
                sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-sm text-center gap-3 py-12">
                    <div className="text-4xl">📭</div>
                    <p>No active sessions.<br/>Start studying to create one.</p>
                  </div>
                ) : sessions.map(s => (
                  <div key={s.id} className="group bg-neutral-800 border border-neutral-700 hover:border-indigo-500/30 rounded-xl overflow-hidden transition-all">
                    <button onClick={() => loadSession(s)} className="w-full text-left p-4 flex items-start gap-3">
                      <span className="text-xl mt-0.5">📄</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">{s.title}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{s.session_documents?.length || 0} PDF{s.session_documents?.length !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 mt-1 flex-shrink-0">Open</span>
                    </button>
                    <div className="px-4 pb-3 flex justify-end -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleArchive(s.id, e)}
                        className="text-xs text-neutral-500 hover:text-amber-400 bg-neutral-700 hover:bg-amber-500/10 border border-neutral-600 hover:border-amber-500/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                        📦 Archive
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Archived sessions ... (kept logic same as provided) */}
              {historyTab === 'archived' && (
                archivedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-sm text-center gap-3 py-12">
                    <div className="text-4xl">🗂️</div>
                    <p>No archived sessions yet.</p>
                  </div>
                ) : archivedSessions.map(s => (
                  <div key={s.id} className="group bg-neutral-800/60 border border-neutral-700/50 hover:border-amber-500/30 rounded-xl overflow-hidden transition-all">
                    <div className="p-4 flex items-start gap-3">
                      <span className="text-xl mt-0.5 opacity-50">📦</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-400 truncate">{s.title}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-3 flex gap-2 justify-end -mt-1">
                      <button onClick={(e) => handleRestore(s.id, e)}
                        className="text-xs text-neutral-500 hover:text-green-400 bg-neutral-700 hover:bg-green-500/10 border border-neutral-600 hover:border-green-500/30 px-3 py-1.5 rounded-lg transition-all">
                        ♻️ Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-neutral-800">
              <button onClick={() => { setShowHistory(false); handleNewSession() }}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all">
                + New Study Session
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}