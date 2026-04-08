'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPassword() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Email, 2: OTP & New Password
  
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // ── STEP 1: SEND OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setError(error.message)
    } else {
      setStep(2)
      setMessage('A 6-digit code has been sent to your email.')
    }
    setLoading(false)
  }

  // ── STEP 2: VERIFY OTP & UPDATE PASSWORD ──
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')

    // 1. Verify the 6-digit OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'recovery' // 🌟 CRITICAL: Tells Supabase this is a password reset OTP!
    })

    if (verifyError) {
      setError('Invalid or expired code. Please try again.')
      setLoading(false)
      return
    }

    // 2. If OTP is correct, update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      setError(updateError.message)
    } else {
      setMessage('Password updated successfully! Redirecting to login...')
      setTimeout(() => router.push('/login'), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-neutral-100">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-sm text-neutral-400">
            {step === 1 ? "Enter your email to receive a reset code." : "Enter your code and new password."}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-400 text-sm p-3 rounded-xl mb-6 text-center">
            {message}
          </div>
        )}

        {step === 1 ? (
          /* ── FORM 1: EMAIL REQUEST ── */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Email Address</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="juan@example.com"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !email}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4">
              {loading ? 'Sending Code...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          /* ── FORM 2: OTP & NEW PASSWORD ── */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">6-Digit Code</label>
              <input 
                type="text" 
                required 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-[0.2em] font-mono text-lg"
                placeholder="123456"
                maxLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">New Password</label>
              <input 
                type="password" 
                required 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !otp || !newPassword}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 mt-4">
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}