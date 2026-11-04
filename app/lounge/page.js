'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createLounge, joinLounge } from '@/app/actions/lounge'
import { Icon } from '@/components/Icons'

const EagleLogo = ({ className = 'w-7 h-7' }) => (
  <img
    src="/logo.png"
    alt="Aguila"
    className={`${className} object-contain`}
    style={{ imageRendering: 'pixelated' }}
  />
)

export default function LoungeLobby() {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('join') // 'join' | 'create'
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })
  }, [router])

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
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Retro Navigation Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-5 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <EagleLogo />
          <div>
            <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
              <span>Study with Aguila</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                LOUNGE
              </span>
            </span>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700/80 transition-all flex items-center gap-1.5 shadow-xs"
        >
          {Icon.history('w-3.5 h-3.5')}
          <span>Back to Desk</span>
        </Link>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl pointer-events-none -top-10" />

        <div className="w-full max-w-md space-y-6 relative z-10">
          {/* Header Card */}
          <div className="text-center space-y-2.5">
            <div className="relative inline-block">
              <div className="w-18 h-18 p-2 rounded-2xl bg-neutral-900 border-2 border-neutral-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.9)] flex items-center justify-center mx-auto">
                <img
                  src="/logo.png"
                  alt="Aguila Lounge"
                  className="w-12 h-12 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono rounded-md font-bold">
                ONLINE
              </span>
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-mono uppercase">
                Student Lounge
              </h1>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Collaborative virtual study rooms with live voice channels, synchronized avatars, and group Pomodoro.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center gap-1">
                {Icon.volume('w-3 h-3 text-emerald-400')}
                <span>Spatial Voice</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center gap-1">
                {Icon.timer('w-3 h-3 text-amber-400')}
                <span>Sync Timer</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center gap-1">
                {Icon.cards('w-3 h-3 text-indigo-400')}
                <span>Shared Quiz</span>
              </span>
            </div>
          </div>

          {/* Retro Segmented Tabs */}
          <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 shadow-inner select-none">
            <button
              type="button"
              onClick={() => { setTab('join'); setError('') }}
              className={`flex-1 py-2 text-xs font-mono font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'join'
                  ? 'bg-neutral-800 text-amber-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {Icon.login('w-3.5 h-3.5')}
              <span>Join Room</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab('create'); setError('') }}
              className={`flex-1 py-2 text-xs font-mono font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'create'
                  ? 'bg-neutral-800 text-indigo-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {Icon.plus('w-3.5 h-3.5')}
              <span>Create Room</span>
            </button>
          </div>

          {/* Form Panel */}
          <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.85)]">
            {error && (
              <div className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2">
                {Icon.xCircle('w-4 h-4 text-red-400 flex-shrink-0')}
                <span>{error}</span>
              </div>
            )}

            {tab === 'join' ? (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono font-bold">
                      6-Character Room Code
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">Case-insensitive</span>
                  </div>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="X4K2PQ"
                    required
                    maxLength={6}
                    autoFocus
                    className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-amber-400 rounded-xl px-4 py-3.5 text-xl font-mono tracking-[0.35em] tabular-nums text-white text-center placeholder-neutral-700 focus:outline-none transition-colors uppercase shadow-inner"
                  />
                  <p className="text-[11px] text-neutral-500 mt-2 text-center font-mono">
                    Paste the 6-character code given by your classmate.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={code.length !== 6 || loading}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border border-neutral-700 text-xs font-mono font-bold rounded-xl disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {loading ? (
                    <>
                      {Icon.spinner('w-4 h-4 text-amber-400')}
                      <span>Connecting to room...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Lounge Room</span>
                      <span>&rarr;</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-neutral-400 mb-1.5 uppercase tracking-wider font-mono font-bold">
                    Lounge Room Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 40))}
                    placeholder="e.g. Bio 101 Midterm Sprint"
                    autoFocus
                    className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-indigo-400 rounded-xl px-4 py-3 text-sm font-sans text-white placeholder-neutral-600 focus:outline-none transition-colors shadow-inner"
                  />
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300 font-mono flex items-start gap-2 leading-relaxed">
                  {Icon.lightbulb('w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5')}
                  <span>A shareable 6-digit room code will be instantly generated for you and your study partners.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 text-xs font-mono font-bold rounded-xl disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {loading ? (
                    <>
                      {Icon.spinner('w-4 h-4 text-white')}
                      <span>Creating room...</span>
                    </>
                  ) : (
                    <>
                      {Icon.plus('w-4 h-4')}
                      <span>Create New Room</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-[11px] text-neutral-600 font-mono">
            Ephemeral room protocol &bull; Active while participants are present
          </p>
        </div>
      </div>
    </main>
  )
}
