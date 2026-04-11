'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── SVG Icons ─────────────────────────────────────────────────────────────
const Icons = {
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Dash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Trophy: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>,
  ArrowRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
}

export default function TakeQuizPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromCode = searchParams.get('from')

  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

  // Quiz State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [isFinished, setIsFinished] = useState(false)
  const [score, setScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        setCurrentUser(session?.user || null)

        const { data: quizData, error: quizErr } = await supabase.from('quizzes').select('*').eq('id', id).single()
        if (quizErr) throw new Error("Quiz not found or deleted.")

        const { data: questionData, error: questErr } = await supabase.from('questions').select('*').eq('quiz_id', id)
        if (questErr) throw new Error("Failed to load questions.")

        const sortedQs = (questionData || []).sort((a,b) => a.id.localeCompare(b.id))
        setQuiz(quizData)
        setQuestions(sortedQs)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchQuizData()
  }, [id])

  const handleSelect = (questionId, choice) => {
    if (answers[questionId]) return 
    setAnswers(prev => ({ ...prev, [questionId]: choice }))
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = async () => {
    setLoading(true)
    let finalScore = 0
    questions.forEach(q => {
      if (answers[q.id] === q.answer) finalScore += 1
    })
    
    setScore(finalScore)
    setIsFinished(true)
    
    if (currentUser) {
      await supabase.from('quiz_results').insert([{
        quiz_id: id, user_id: currentUser.id, score: finalScore, total: questions.length, quiz_title: quiz?.title || 'Shared Quiz'
      }])
    }

    const { data: lbData } = await supabase
      .from('quiz_results')
      .select('id, user_id, score, total')
      .eq('quiz_id', id)
      .order('score', { ascending: false })
      
    const uniqueLb = []
    const seen = new Set()
    if (lbData) {
      lbData.forEach(entry => {
        if (!seen.has(entry.user_id)) {
          seen.add(entry.user_id)
          uniqueLb.push(entry)
        }
      })
    }
    setLeaderboard(uniqueLb)
    setLoading(false)
  }

  // ── CSS STYLES (Dotted Grid + Split Scroll) ─────────────────────────────
  const baseStyles = `
    .quiz-container { 
      height: 100dvh; 
      display: flex; 
      flex-direction: column; 
      background-color: #0A0A0A;
      background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
      background-size: 24px 24px;
      color: #E5E5E5; 
      font-family: Inter, system-ui, sans-serif; 
      overflow: hidden; 
    }

    /* Custom Clean Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #262626; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #404040; }

    .card { background: #121212; border: 1px solid #262626; border-radius: 8px; padding: 1.5rem; }
    .card-title { font-size: 1rem; font-weight: 600; color: #FAFAFA; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; }
    
    .btn { display: inline-flex; alignItems: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.15s; border: 1px solid transparent; text-decoration: none; }
    .btn-primary { background: #EDEDED; color: #0A0A0A; }
    .btn-primary:hover { background: #D4D4D4; }
    .btn-secondary { background: transparent; border-color: #262626; color: #A3A3A3; }
    .btn-secondary:hover { background: #171717; color: #E5E5E5; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat-box { display: flex; flex-direction: column; align-items: center; padding: 1rem; border-radius: 8px; border: 1px solid; }

    /* Dashboard Layout */
    .dash-header { padding: 2rem 1rem 0 1rem; flex-shrink: 0; max-width: 900px; width: 100%; margin: 0 auto; }
    .dash-content { flex: 1; min-height: 0; max-width: 900px; width: 100%; margin: 0 auto; padding: 0 1rem 2rem 1rem; }
    
    @media (max-width: 767px) {
      .dash-content { overflow-y: auto; }
      .scroll-col { margin-bottom: 2rem; }
    }
    @media (min-width: 768px) {
      .dash-content { display: grid; grid-template-columns: 300px 1fr; gap: 2rem; overflow: hidden; }
      .scroll-col { height: 100%; overflow-y: auto; padding-right: 0.5rem; }
    }
    
    /* Quiz Active View */
    .active-quiz-wrapper { height: 100%; overflow-y: auto; padding: 2rem 1rem; display: flex; flex-direction: column; }
    .active-max-w { max-width: 600px; width: 100%; margin: 0 auto; }
    
    .choice-btn { width: 100%; display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #0A0A0A; border: 1px solid #262626; border-radius: 6px; color: #A3A3A3; cursor: pointer; text-align: left; font-size: 0.95rem; transition: border-color 0.1s, background 0.1s; margin-bottom: 0.75rem; }
    .choice-btn:hover:not(:disabled) { border-color: #525252; background: #121212; }
    .choice-key { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; background: #262626; color: #A3A3A3; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
    
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
  `

  // ── UI RENDERING ────────────────────────────────────────────────────────
  if (loading && !isFinished) {
    return (
      <div className="quiz-container" style={{ alignItems:'center', justifyContent:'center' }}>
        <style>{baseStyles}</style>
        <div style={{ color: '#A3A3A3', fontSize: '0.875rem' }}>Loading assessment...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="quiz-container" style={{ alignItems:'center', justifyContent:'center' }}>
        <style>{baseStyles}</style>
        <div className="card" style={{ textAlign: 'center', borderColor: '#450a0a', background: '#2a0a0a' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#f87171' }}>Error Loading Quiz</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#fca5a5' }}>{error}</p>
        </div>
      </div>
    )
  }

  // 🏆 RESULTS DASHBOARD (Fixed Header, Scrollable Columns)
  if (isFinished) {
    const accuracy = Math.round((score / questions.length) * 100)
    const correctCount = score
    const unansweredCount = questions.length - Object.keys(answers).length
    const incorrectCount = questions.length - correctCount - unansweredCount

    return (
      <div className="quiz-container">
        <style>{baseStyles}</style>
        
        {/* Fixed Header Area */}
        <div className="dash-header">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#FAFAFA' }}>{accuracy}%</h1>
            <p style={{ fontSize: '1rem', color: '#A3A3A3', margin: 0 }}>You scored {score} out of {questions.length}</p>
          </div>

          <div className="stats-grid">
            <div className="stat-box" style={{ background: '#022c22', borderColor: '#065f46', color: '#10b981' }}>
              <Icons.Check />
              <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>{correctCount}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase' }}>Correct</div>
            </div>
            <div className="stat-box" style={{ background: '#450a0a', borderColor: '#7f1d1d', color: '#ef4444' }}>
              <Icons.X />
              <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>{incorrectCount}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase' }}>Incorrect</div>
            </div>
            <div className="stat-box" style={{ background: '#171717', borderColor: '#262626', color: '#A3A3A3' }}>
              <Icons.Dash />
              <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>{unansweredCount}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase' }}>Skipped</div>
            </div>
          </div>
        </div>

        {/* Scrollable Split Content Area */}
        <div className="dash-content">
          
          {/* Left Column: Leaderboard */}
          <div className="scroll-col">
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 className="card-title"><Icons.Trophy /> High Scores</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {leaderboard.length === 0 ? <div style={{fontSize: '0.875rem', color: '#737373'}}>No scores yet.</div> : null}
                {leaderboard.slice(0, 5).map((entry, idx) => {
                  const isMe = entry.user_id === currentUser?.id
                  return (
                    <div key={entry.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: isMe ? '#171717' : 'transparent', border: '1px solid', borderColor: isMe ? '#404040' : '#262626', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.875rem', color: isMe ? '#FAFAFA' : '#A3A3A3', fontWeight: isMe ? 600 : 400 }}>
                        {idx + 1}. {isMe ? 'You' : `Player ${entry.user_id.slice(0, 4)}`}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#FAFAFA', fontWeight: 500 }}>
                        {entry.score} / {entry.total}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <Link href={fromCode ? `/lounge/${fromCode}` : '/quiz'} className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
              {fromCode ? 'Return to Lounge' : 'Back to Dashboard'}
            </Link>
          </div>

          {/* Right Column: Review Area */}
          <div className="scroll-col">
            <h2 style={{ fontSize: '1.125rem', color: '#FAFAFA', margin: '0 0 1rem 0' }}>Review Answers</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {questions.map((q, idx) => {
                const myAns = answers[q.id]
                const isCorrect = myAns === q.answer
                const statusColor = isCorrect ? '#10b981' : myAns ? '#ef4444' : '#737373'
                const statusBg = isCorrect ? '#022c22' : myAns ? '#450a0a' : '#171717'
                
                return (
                  <div key={q.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 500, margin: 0, lineHeight: 1.5, color: '#E5E5E5' }}>{idx + 1}. {q.question}</h3>
                      <div className="badge" style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}40`, flexShrink: 0 }}>
                        {isCorrect ? <Icons.Check /> : myAns ? <Icons.X /> : <Icons.Dash />}
                        {isCorrect ? 'Correct' : myAns ? 'Incorrect' : 'Skipped'}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                      {myAns && !isCorrect && (
                        <div style={{ fontSize: '0.875rem', color: '#ef4444', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <Icons.X /> <span style={{ paddingTop: '2px' }}>{q.choices[myAns]}</span>
                        </div>
                      )}
                      <div style={{ fontSize: '0.875rem', color: '#10b981', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <Icons.Check /> <span style={{ paddingTop: '2px' }}>{q.choices[q.answer]}</span>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem', borderRadius: '6px', background: '#0A0A0A', border: '1px solid #262626', fontSize: '0.875rem', color: '#A3A3A3', lineHeight: 1.6 }}>
                      <strong style={{ color: '#D4D4D4', fontWeight: 500 }}>Explanation:</strong> {q.explanation}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    )
  }

  // 📝 ACTIVE QUIZ VIEW
  const currentQ = questions[currentIndex]
  const hasAnswered = !!answers[currentQ?.id]
  const myAnswer = answers[currentQ?.id]
  const progress = ((currentIndex) / questions.length) * 100

  return (
    <div className="quiz-container">
      <style>{baseStyles}</style>
      <div className="active-quiz-wrapper">
        <div className="active-max-w">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 500, margin: 0, color: '#A3A3A3' }}>{quiz?.title || 'Assessment'}</h1>
            <Link href={fromCode ? `/lounge/${fromCode}` : '/quiz'} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>Exit</Link>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#737373', marginBottom: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Question {currentIndex + 1} of {questions.length}</span>
            </div>
            
            <div style={{ height: '4px', background: '#262626', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#EDEDED', transition: 'width 0.3s ease' }} />
            </div>

            <h2 style={{ fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.5, margin: '0 0 2rem 0', color: '#FAFAFA' }}>{currentQ?.question}</h2>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {['A', 'B', 'C', 'D'].map(key => {
                if (!currentQ?.choices || !currentQ.choices[key]) return null
                
                const isThisChoiceMine = myAnswer === key
                const isThisChoiceCorrect = currentQ.answer === key
                
                let btnStyle = {}
                let keyStyle = {}

                if (hasAnswered) {
                  if (isThisChoiceCorrect) {
                    btnStyle = { borderColor: '#059669', background: '#022c22', color: '#10b981' }
                    keyStyle = { background: '#059669', color: '#fff' }
                  } else if (isThisChoiceMine) {
                    btnStyle = { borderColor: '#dc2626', background: '#450a0a', color: '#ef4444' }
                    keyStyle = { background: '#dc2626', color: '#fff' }
                  }
                } else if (isThisChoiceMine) {
                  btnStyle = { borderColor: '#A3A3A3', background: '#171717', color: '#FAFAFA' }
                  keyStyle = { background: '#A3A3A3', color: '#0A0A0A' }
                }

                return (
                  <button key={key} onClick={() => handleSelect(currentQ.id, key)} disabled={hasAnswered} className="choice-btn" style={btnStyle}>
                    <span className="choice-key" style={keyStyle}>{key}</span>
                    <span style={{ lineHeight: 1.5 }}>{currentQ.choices[key]}</span>
                    
                    {hasAnswered && isThisChoiceCorrect && <span style={{ marginLeft:'auto' }}><Icons.Check /></span>}
                    {hasAnswered && isThisChoiceMine && !isThisChoiceCorrect && <span style={{ marginLeft:'auto' }}><Icons.X /></span>}
                  </button>
                )
              })}
            </div>

            {hasAnswered && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#0A0A0A', border: '1px solid #262626', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#A3A3A3', lineHeight: 1.6 }}>
                  <strong style={{ color: '#D4D4D4', fontWeight: 500 }}>Explanation: </strong>
                  {currentQ?.explanation}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              {hasAnswered && (
                <button onClick={handleNext} className="btn btn-primary">
                  {currentIndex === questions.length - 1 ? 'View Results' : 'Continue'} <Icons.ArrowRight />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}