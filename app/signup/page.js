'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('signup') // 'signup' | 'verify'
  const [otp, setOtp] = useState('')
  const router = useRouter()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setStep('verify')
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const cleanOtp = otp.trim()
    
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup'
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-indigo-500/10 flex items-center justify-center overflow-hidden border border-indigo-500/20">
            <span className="text-3xl">🦅</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Study with Aguila
          </h1>
          <p className="text-neutral-500 text-sm mt-2">
            {step === 'signup' ? 'Create your account' : 'Check your email'}
          </p>
        </div>

        {/* Signup Form */}
        {step === 'signup' && (
          <form onSubmit={handleSignup} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 space-y-4">
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>
            )}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" required minLength={6}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 pr-12 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors text-lg">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-[0.98]">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}

        {/* OTP Verification */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 space-y-4">
            <div className="text-center mb-2">
              <div className="text-3xl mb-2">📬</div>
              <p className="text-neutral-300 text-sm">We sent a 8-digit code to</p>
              <p className="text-indigo-400 text-sm font-medium">{email}</p>
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>
            )}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Verification code</label>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="12345678" maxLength={8} required
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center tracking-[0.5em] text-lg font-mono" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button type="button" onClick={() => { setStep('signup'); setError(null) }}
              className="w-full text-neutral-500 hover:text-neutral-300 text-sm transition-colors">
              ← Back to signup
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </main>
  )
}