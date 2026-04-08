'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    {open ? (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    ) : (
      <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
    )}
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-indigo-400">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const EagleLogo = () => (
  <svg viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
    <polygon points="14,14 16,6 19,13" fill="#4A2F0A"/>
    <polygon points="18,12 21,4 24,11" fill="#5C3D11"/>
    <polygon points="22,11 25,3 28,10" fill="#4A2F0A"/>
    <ellipse cx="24" cy="23" rx="13" ry="12" fill="#8B5E2A"/>
    <ellipse cx="25" cy="25" rx="8.5" ry="7.5" fill="#F2DEB0"/>
    <polygon points="33,22 42,25 33,28" fill="#F5C218"/>
    <circle cx="29" cy="22" r="3" fill="#1A0800"/>
    <circle cx="30" cy="21" r="0.8" fill="#fff"/>
    <ellipse cx="24" cy="42" rx="13" ry="11" fill="#8B5E2A"/>
    <ellipse cx="24" cy="44" rx="7" ry="7.5" fill="#F2DEB0"/>
    <path d="M11 38 Q2 44 4 52 Q12 46 19 44" fill="#5C3D11"/>
    <path d="M37 38 Q46 44 44 52 Q36 46 29 44" fill="#5C3D11"/>
  </svg>
)

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('signup')
  const [otp, setOtp] = useState('')
  const router = useRouter()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { setStep('verify'); setLoading(false) }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'signup' })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/eula')
  }

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <EagleLogo/>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Study with Aguila
          </h1>
          <p className="text-neutral-500 text-sm mt-1.5">
            {step === 'signup' ? 'Create your account' : 'Verify your email'}
          </p>
        </div>

        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">{error}</div>}

          {step === 'signup' ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoComplete="email"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters" required minLength={6}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 pr-11 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1">
                    <EyeIcon open={showPassword}/>
                  </button>
                </div>
              </div>
              <p className="text-xs text-neutral-600">
                By creating an account, you agree to our{' '}
                <Link href="/eula" className="text-indigo-400 underline">Terms of Use</Link>.
              </p>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm">
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-center py-2">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <MailIcon/>
                </div>
                <p className="text-sm text-neutral-300">We sent a verification code to</p>
                <p className="text-indigo-400 text-sm font-semibold mt-0.5">{email}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Verification code</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                  placeholder="Enter code" maxLength={6} required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-[0.4em] text-lg font-mono"/>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm">
                {loading ? 'Verifying...' : 'Verify and continue'}
              </button>
              <button type="button" onClick={() => { setStep('signup'); setError(null) }}
                className="w-full text-neutral-500 hover:text-neutral-300 text-sm transition-colors py-1">
                Back to sign up
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-neutral-600 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </main>
  )
}