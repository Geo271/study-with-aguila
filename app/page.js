'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { processPDF } from './actions/pdf'
import { askDocument } from './actions/chat'
import { generateQuiz } from './actions/quiz'
import QuizMode from '@/components/QuizMode'
import { getChatHistory } from './actions/history'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [documentId, setDocumentId] = useState(null)
  const [mode, setMode] = useState('chat')

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const [quizQuestions, setQuizQuestions] = useState(null)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [quizKey, setQuizKey] = useState(0)

  const [questionCount, setQuestionCount] = useState(5)
  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        setAuthLoading(false)
        const hist = await getChatHistory(session.user.id)
        if (hist.success) setHistory(hist.history)
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleNewChat = () => {
    setDocumentId(null)
    setStatus('idle')
    setFile(null)
    setMessages([])
    setMode('chat')
    setQuizQuestions(null)
    // Optional: Refresh the history so the document they just finished chatting with appears in the drawer
    const refreshHistory = async () => {
      const hist = await getChatHistory(user.id)
      if (hist.success) setHistory(hist.history)
    }
    refreshHistory()
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setStatus('loading')

    const formData = new FormData()
    formData.append('file', file)
    const result = await processPDF(formData, user.id)

    if (result.success) {
      setDocumentId(result.documentId)
      setStatus('ready')
      setMessages([{
        role: 'ai',
        content: `Notes uploaded! I've processed ${result.totalChunks} sections from your PDF. Ask me anything about your notes, or hit Generate Quiz to test yourself! 🎯`
      }])
    } else {
      setStatus('error')
      alert('Upload failed: ' + result.error)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || !documentId) return

    const userMsg = input.trim()
    setInput('')
    
    // THE SMART INTERCEPT
    const lowerMsg = userMsg.toLowerCase()
    if (lowerMsg.includes('quiz') || lowerMsg.includes('test me')) {
      
      // Look for any number inside the user's message (e.g., "11")
      const numberMatch = userMsg.match(/\d+/);
      let requestedCount = questionCount; // Default to dropdown value
      
      if (numberMatch) {
        requestedCount = parseInt(numberMatch[0], 10);
        // Cap it at a reasonable maximum so they don't ask for 1,000 questions and crash the AI
        if (requestedCount > 30) requestedCount = 30; 
      }

      setMessages(prev => [...prev, { role: 'user', content: userMsg }])
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: `You got it! Switching to Quiz Mode and generating a ${requestedCount}-question test now... 🧪` 
      }])
      
      // Pass the extracted number directly into the generator
      handleGenerateQuiz(requestedCount) 
      return 
    }

    // Normal chat logic continues...
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsTyping(true)

    const result = await askDocument(userMsg, documentId, user.id)
    setIsTyping(false)

    setMessages(prev => [...prev, {
      role: 'ai',
      content: result.success ? result.answer : 'Something went wrong. Try again!'
    }])
  }

  const handleGenerateQuiz = async (customCount = null) => {
    setIsGeneratingQuiz(true)
    
    // Use the custom count from chat, or default to the dropdown state
    const finalCount = customCount || questionCount;
    
    const result = await generateQuiz(documentId, user.id, finalCount)
    setIsGeneratingQuiz(false)

    if (result.success) {
      setQuizQuestions(result.questions)
      setMode('quiz')
      
      if (result.questions.length < finalCount) {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: `I analyzed your notes, and to keep the quality high without repeating myself, I generated ${result.questions.length} unique questions instead of ${finalCount}. Good luck! 🎯` 
        }])
      }
    } else {
      alert('Quiz generation failed: ' + result.error)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-500">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin"/>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-500/30">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Study with Aguila 🦅
          </h1>

          <div className="flex items-center gap-2">
            {status === 'ready' && (
              <>
                <button onClick={() => { setMode(mode === 'quiz' ? 'chat' : 'quiz') }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    mode === 'quiz'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-indigo-500/40 hover:text-indigo-300'
                  }`}>
                  {mode === 'quiz' ? '← Chat' : '🧪 Quiz'}
                </button>
                <div className="text-xs px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                  PDF Active
                </div>
              </>
            )}

            <button onClick={handleNewChat}
              className="text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-xl transition-all border border-neutral-700">
              ➕ New Chat
            </button>

            <button onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-xl transition-all border border-neutral-700">
              📜 History
            </button>
            <button onClick={handleLogout}
              className="text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-xl transition-all border border-neutral-700">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">

        {/* Upload screen */}
        {status !== 'ready' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-800 w-full max-w-md text-center">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">
                📄
              </div>
              <h2 className="text-2xl font-bold mb-2">Upload Your Notes</h2>
              <p className="text-neutral-400 text-sm mb-8">
                Upload a PDF to start chatting with your notes and generating quizzes.
              </p>

              <form onSubmit={handleUpload} className="space-y-4">
                <label className="block w-full border-2 border-dashed border-neutral-700 rounded-xl p-6 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                  <div className="text-3xl mb-2">📎</div>
                  <div className="text-sm text-neutral-400 group-hover:text-neutral-300 truncate px-2">
                    {file ? file.name : 'Click to choose a PDF'}
                  </div>
                  <input type="file" accept="application/pdf"
                    onChange={e => setFile(e.target.files[0])}
                    className="hidden" />
                </label>

                <button type="submit" disabled={!file || status === 'loading'}
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-all active:scale-[0.98]">
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Analyzing Notes...
                    </span>
                  ) : 'Upload & Start Studying'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Chat mode */}
        {status === 'ready' && mode === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900/50 rounded-2xl border border-neutral-800 mt-2">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-base mb-0.5">
                      🦅
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                      : 'bg-neutral-800 text-neutral-200 rounded-bl-none border border-neutral-700'
                  }`}>
                    {msg.content.split('\n').map((line, j) => <span key={j}>{line}<br /></span>)}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start items-end gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-base mb-0.5">
                    🦅
                  </div>
                  <div className="bg-neutral-800 rounded-2xl rounded-bl-none px-5 py-4 border border-neutral-700 flex space-x-1.5">
                    {[0, 75, 150].map(d => (
                      <div key={d} className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-neutral-900 border-t border-neutral-800 space-y-3">
              <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}
                className="w-full py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isGeneratingQuiz ? (
                  <>
                    <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    Generating quiz...
                  </>
                ) : '🧪 Generate Quiz from Notes'}
              </button>

              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Ask anything about your notes..."
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-neutral-100 placeholder-neutral-500" />
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
          <div className="flex-1 overflow-hidden bg-neutral-900/50 rounded-2xl border border-neutral-800 mt-2 min-h-[500px]">
            {quizQuestions ? (
              <QuizMode
                key={quizKey}
                questions={quizQuestions}
                onFinish={() => setMode('chat')}
                onRetake={() => setQuizKey(k => k + 1)}
              />
            ) : (
             <div className="flex flex-col items-center gap-4">
  <div className="flex items-center gap-3 bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-700">
    <label className="text-sm text-neutral-400">Questions:</label>
    <select 
      value={questionCount} 
      onChange={(e) => setQuestionCount(Number(e.target.value))}
      className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
    >
      <option value={5}>5 Questions</option>
      <option value={10}>10 Questions</option>
      <option value={15}>15 Questions</option>
      <option value={20}>20 Questions</option>
    </select>
  </div>

  <button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz}
    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
    {isGeneratingQuiz ? (
      <>
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Generating...
      </>
    ) : '🎯 Start Quiz'}
  </button>
</div>
            )}
          </div>
        )}
      </div>
      
      {/* History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative ml-auto w-full max-w-sm bg-neutral-900 border-l border-neutral-800 h-full overflow-y-auto p-5 flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-white text-lg">Chat History</h2>
              <button onClick={() => setShowHistory(false)}
                className="text-neutral-500 hover:text-white w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center transition-colors">
                ✕
              </button>
            </div>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 gap-3">
                <div className="text-4xl">📭</div>
                <p className="text-sm">No chat history yet. Upload a PDF and start studying!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <button key={i}
                    onClick={() => {
                      setDocumentId(h.documentId)
                      setStatus('ready')
                      setMessages(h.messages)
                      setMode('chat')
                      setShowHistory(false)
                    }}
                    className="w-full text-left p-4 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 hover:border-indigo-500/40 rounded-xl transition-all group">
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0 mt-0.5">📄</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white truncate transition-colors">
                          {h.fileName}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {h.messages.length} messages
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}