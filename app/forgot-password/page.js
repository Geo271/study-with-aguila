'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <span className="text-3xl">🦅</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Study with Aguila
          </h1>
          <p className="text-neutral-500 text-sm mt-2">Reset your password</p>
        </div>

        {!sent ? (
          <form onSubmit={handleReset} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 space-y-4">
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>
            )}
            <p className="text-neutral-400 text-sm">Enter your email and we'll send you a reset link.</p>
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8 text-center space-y-3">
            <div className="text-4xl">📬</div>
            <h3 className="text-white font-semibold">Check your email</h3>
            <p className="text-neutral-400 text-sm">We sent a password reset link to <span className="text-indigo-400">{email}</span></p>
          </div>
        )}

        <p className="text-center text-sm text-neutral-500 mt-4">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">← Back to login</Link>
        </p>
      </div>
    </main>
  )
}