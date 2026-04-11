// app/quiz/page.js
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function QuizDashboard() {
  const [quizzes,  setQuizzes]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(null)
  const router       = useRouter()
  const searchParams = useSearchParams()

  // `from` is the lounge invite code — present when the user came from a lounge room.
  // If set, "Back to Lounge" returns them to that specific room instead of the lobby.
  const fromCode = searchParams.get('from')
  const backHref = fromCode ? `/lounge/${fromCode}` : '/lounge'
  const backLabel = fromCode ? '← Back to Lounge' : '← Lounge Lobby'

  useEffect(() => {
    const fetchQuizzes = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('quizzes')
        .select('*, questions(id)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (data) setQuizzes(data)
      setLoading(false)
    }
    fetchQuizzes()
  }, [])

  const handleDelete = async (e, quizId) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this quiz?')) return
    setDeleting(quizId)
    await supabase.from('quizzes').delete().eq('id', quizId)
    setQuizzes(prev => prev.filter(q => q.id !== quizId))
    setDeleting(null)
  }

  if (loading) return (
    <div style={{ height:'100dvh', background:'#09090b', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ color:'#818cf8', fontWeight:700, fontSize:13 }}>Loading quizzes...</span>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#09090b', color:'#fff', fontFamily:'system-ui', padding:'32px 20px' }}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32, paddingBottom:20, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:0, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, padding:'4px 8px', fontSize:15 }}>📝</span>
              Quiz Dashboard
            </h1>
            <p style={{ color:'#71717a', fontSize:12, marginTop:6 }}>
              {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} · click any card to take it
            </p>
          </div>

          {/* Back button — returns to the exact lounge room if `from` param is set */}
          <Link
            href={backHref}
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#a1a1aa', textDecoration:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}
          >
            {backLabel}
            {fromCode && (
              <span style={{ background:'rgba(99,102,241,0.15)', color:'#818cf8', fontSize:10, padding:'1px 6px', borderRadius:4, fontFamily:'monospace', letterSpacing:'0.05em' }}>
                {fromCode}
              </span>
            )}
          </Link>
        </div>

        {/* Empty state */}
        {quizzes.length === 0 ? (
          <div style={{ background:'#18181b', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:60, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:14 }}>📭</div>
            <h3 style={{ color:'#f4f4f5', fontSize:17, marginBottom:8 }}>No quizzes yet</h3>
            <p style={{ color:'#71717a', fontSize:13, lineHeight:1.6 }}>
              Upload a PDF in the lounge chat, then type{' '}
              <code style={{ background:'rgba(99,102,241,0.15)', padding:'1px 6px', borderRadius:4, color:'#818cf8' }}>
                @aguila quiz 10 questions
              </code>{' '}
              to generate one from your notes.
            </p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
            {quizzes.map(quiz => (
              <div
                key={quiz.id}
                style={{ background:'#18181b', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20, display:'flex', flexDirection:'column', position:'relative', transition:'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='rgba(99,102,241,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}
              >
                {/* Delete button */}
                <button
                  onClick={e => handleDelete(e, quiz.id)}
                  disabled={deleting === quiz.id}
                  style={{ position:'absolute', top:12, right:12, background:'transparent', border:'none', color:'#52525b', cursor:'pointer', fontSize:13, padding:4, borderRadius:4 }}
                  title="Delete quiz"
                >
                  {deleting === quiz.id ? '…' : '✕'}
                </button>

                <h3 style={{ fontSize:13, fontWeight:700, color:'#f4f4f5', marginBottom:6, paddingRight:20 }}>
                  {quiz.title || 'Review Quiz'}
                </h3>

                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#71717a', marginBottom:18 }}>
                  <span style={{ background:'rgba(99,102,241,0.15)', color:'#818cf8', padding:'2px 8px', borderRadius:4, fontWeight:700 }}>
                    {quiz.questions?.length ?? 0} Qs
                  </span>
                  <span>·</span>
                  <span>{new Date(quiz.created_at).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}</span>
                </div>

                {/* Take Quiz — passes `from` code so the quiz room can also navigate back correctly */}
                <Link
                  href={`/quiz/${quiz.id}${fromCode ? `?from=${fromCode}` : ''}`}
                  style={{ marginTop:'auto', background:'#4f46e5', color:'#fff', textDecoration:'none', padding:'9px 0', borderRadius:8, fontSize:12, fontWeight:700, textAlign:'center', display:'block' }}
                >
                  Take Quiz →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}