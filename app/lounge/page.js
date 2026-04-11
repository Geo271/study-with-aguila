'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createLounge, joinLounge } from '@/app/actions/lounge'

// Pixel-art eagle reused from your existing app
const EagleLogo = ({ className = 'w-8 h-8' }) => (
  <img src="/logo.png" alt="Aguila" className={`${className} object-contain rounded-full`} />
)

export default function LoungeLobby() {
  const [user,       setUser]       = useState(null)
  const [tab,        setTab]        = useState('join')  // 'join' | 'create'
  const [code,       setCode]       = useState('')
  const [name,       setName]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const router = useRouter()
  
 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })
  }, [])

  const handleJoin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await joinLounge(code)
    setLoading(false)
    if (!result.success) return setError(result.error)
    router.push(`/lounge/${result.lounge.invite_code}`)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await createLounge(user.id, name || 'Study Lounge')
    setLoading(false)
    if (!result.success) return setError(result.error)
    router.push(`/lounge/${result.lounge.invite_code}`)
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <EagleLogo />
          <span className="font-bold text-sm">Study with Aguila</span>
        </div>
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Back to study
        </Link>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">

          {/* Title */}
          <div className="text-center space-y-2">
            {/* Room icon */}
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Student Lounge</h1>
            <p className="text-sm text-neutral-500">A virtual study room with voice chat and live avatars.</p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 gap-1">
            {[['join', 'Join a lounge'], ['create', 'Create a lounge']].map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  tab === t ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Forms */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            {error && (
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
                {error}
              </div>
            )}

            {tab === 'join' ? (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wide font-medium">
                    6-character invite code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="X4K2PQ"
                    required
                    maxLength={6}
                    autoFocus
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-lg font-mono tracking-[0.3em] text-white text-center placeholder-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                  <p className="text-xs text-neutral-600 mt-1.5 text-center">
                    Ask the room host for their invite code.
                  </p>
                </div>
                <button type="submit" disabled={code.length !== 6 || loading}
                  className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all">
                  {loading ? 'Checking...' : 'Join lounge →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wide font-medium">
                    Room name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 40))}
                    placeholder="e.g. ENGG 101 Finals Prep"
                    autoFocus
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-xl p-3 text-xs text-indigo-300 leading-relaxed">
                  A random 6-character code will be generated. Share it with friends to let them join.
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all">
                  {loading ? 'Creating...' : 'Create lounge →'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-neutral-700">
            Rooms are ephemeral — they exist as long as someone is inside.
          </p>
        </div>
      </div>
    </main>
  )
}