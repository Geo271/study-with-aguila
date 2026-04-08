'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const MailSentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-8 h-8 text-indigo-400">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
    <polyline points="16 2 22 8 16 14"/><line x1="10" y1="8" x2="22" y2="8"/>
  </svg>
)

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
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6">
            <BackIcon/> Back to login
          </Link>
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-neutral-500 text-sm mt-1.5">
            {sent ? 'Check your email for a reset link.' : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
          {!sent ? (
            <form onSubmit={handleReset} className="space-y-4">
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm">
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <MailSentIcon/>
              </div>
              <p className="text-neutral-300 text-sm">A reset link was sent to</p>
              <p className="text-indigo-400 font-semibold text-sm">{email}</p>
              <p className="text-neutral-600 text-xs">Check your spam folder if you don't see it.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}