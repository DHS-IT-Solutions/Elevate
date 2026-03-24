'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [LoginForm] ${message}`, data)
    : fn(`[${ts}] [${level}] [LoginForm] ${message}`)
}

export default function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router  = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // ── Basic client-side validation ──────────────────────────────────────────
    if (!email.trim()) {
      log('WARN', 'Login blocked — email field is empty')
      setError('Email is required')
      setLoading(false)
      return
    }

    if (!password) {
      log('WARN', 'Login blocked — password field is empty')
      setError('Password is required')
      setLoading(false)
      return
    }

    // Log email but never the password
    log('INFO', 'Login attempt started', { email })

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        // Distinguish the two most common Supabase auth error codes so the
        // log tells you immediately whether it's a wrong credential vs a
        // network/service problem.
        if (
          authError.message.toLowerCase().includes('invalid login') ||
          authError.message.toLowerCase().includes('invalid credentials') ||
          authError.status === 400
        ) {
          log('WARN', 'Login failed — invalid credentials', {
            email,
            status: authError.status,
            message: authError.message,
          })
        } else {
          log('ERROR', 'Login failed — unexpected auth error', {
            email,
            status: authError.status,
            message: authError.message,
            name: authError.name,
          })
        }

        setError(authError.message)
        setLoading(false)
        return
      }

      if (!data.session) {
        // signInWithPassword succeeded but returned no session — unusual,
        // could indicate email confirmation is required.
        log('WARN', 'Login returned no session — email confirmation may be required', {
          email,
          userId: data.user?.id ?? 'unknown',
          emailConfirmedAt: data.user?.email_confirmed_at ?? null,
        })
        setError('Please confirm your email address before signing in.')
        setLoading(false)
        return
      }

      log('INFO', 'Login successful', {
        userId: data.user?.id,
        email: data.user?.email,
        sessionExpiresAt: data.session.expires_at,
      })

      log('DEBUG', 'Navigating to /dashboard')
      router.push('/dashboard')
      router.refresh()

    } catch (err) {
      log('ERROR', 'Unexpected exception during login', {
        email,
        error: err instanceof Error ? err.message : String(err),
      })
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                     focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                     focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md 
                   shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}