'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [SignupForm] ${message}`, data)
    : fn(`[${ts}] [${level}] [SignupForm] ${message}`)
}

export default function SignupForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // ── Client-side validation ────────────────────────────────────────────────
    if (!firstName.trim()) {
      log('WARN', 'Signup blocked — first name is empty')
      setError('First name is required')
      setLoading(false)
      return
    }

    if (!lastName.trim()) {
      log('WARN', 'Signup blocked — last name is empty')
      setError('Last name is required')
      setLoading(false)
      return
    }

    if (!email.trim()) {
      log('WARN', 'Signup blocked — email is empty')
      setError('Email is required')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      log('WARN', 'Signup blocked — password too short', { length: password.length })
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    // Never log the password — email and name only
    log('INFO', 'Signup attempt started', {
      email,
      firstName,
      lastName,
    })

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name:  lastName,
          },
        },
      })

      if (signUpError) {
        // Common Supabase signup errors worth distinguishing:
        // - 422: email already registered
        // - 429: rate limited
        // - anything else: unexpected
        if (
          signUpError.status === 422 ||
          signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists')
        ) {
          log('WARN', 'Signup failed — email already registered', {
            email,
            status: signUpError.status,
            message: signUpError.message,
          })
        } else if (signUpError.status === 429) {
          log('WARN', 'Signup failed — rate limited', {
            email,
            status: signUpError.status,
            message: signUpError.message,
          })
        } else {
          log('ERROR', 'Signup failed — unexpected auth error', {
            email,
            status: signUpError.status,
            message: signUpError.message,
            name: signUpError.name,
          })
        }

        setError(signUpError.message)
        setLoading(false)
        return
      }

      // ── Supabase signUp edge cases ──────────────────────────────────────────
      // When email confirmations are enabled, signUp returns a user with
      // identities[] = [] for an already-registered email instead of an error.
      // This is a Supabase quirk — detect it explicitly.
      if (data.user && data.user.identities?.length === 0) {
        log('WARN', 'Signup returned empty identities — email likely already registered', {
          email,
          userId: data.user.id,
          hint: 'Supabase returns this instead of an error when email confirmations are on',
        })
        setError('An account with this email already exists. Please sign in instead.')
        setLoading(false)
        return
      }

      if (!data.user) {
        log('WARN', 'Signup succeeded but returned no user object', {
          email,
          hint: 'This is unusual — session and user should both be present or confirmation pending',
        })
      } else {
        log('INFO', 'Signup successful', {
          userId: data.user.id,
          email: data.user.email,
          emailConfirmedAt: data.user.email_confirmed_at ?? null,
          confirmationRequired: !data.session,
        })

        if (!data.session) {
          log('DEBUG', 'No session returned — email confirmation is required before sign-in')
        } else {
          log('DEBUG', 'Session created immediately — email confirmation not required', {
            sessionExpiresAt: data.session.expires_at,
          })
        }
      }

      log('DEBUG', 'Setting success state — showing confirmation screen')
      setSuccess(true)
      setLoading(false)

    } catch (err) {
      log('ERROR', 'Unexpected exception during signup', {
        email,
        error: err instanceof Error ? err.message : String(err),
      })
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="text-green-600 text-5xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Check your email!
        </h2>
        <p className="text-gray-600 text-sm">
          We sent a confirmation link to <strong>{email}</strong>.
          Click the link to activate your account, then sign in.
        </p>
        <button
          onClick={() => {
            log('DEBUG', 'User navigating to /login from signup success screen', { email })
            router.push('/login')
          }}
          className="mt-6 w-full py-2 px-4 bg-blue-600 text-white rounded-md 
                     hover:bg-blue-700 text-sm font-medium"
        >
          Go to Sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 
                        rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName"
                 className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md 
                       shadow-sm focus:outline-none focus:ring-blue-500 
                       focus:border-blue-500 text-sm"
            placeholder="First nameS"
          />
        </div>
        <div>
          <label htmlFor="lastName"
                 className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md 
                       shadow-sm focus:outline-none focus:ring-blue-500 
                       focus:border-blue-500 text-sm"
            placeholder="Last name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email"
               className="block text-sm font-medium text-gray-700 mb-1">
          Work Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md 
                     shadow-sm focus:outline-none focus:ring-blue-500 
                     focus:border-blue-500 text-sm"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password"
               className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md 
                     shadow-sm focus:outline-none focus:ring-blue-500 
                     focus:border-blue-500 text-sm"
          placeholder="Min. 6 characters"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent 
                   rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                   hover:bg-blue-700 focus:outline-none focus:ring-2 
                   focus:ring-offset-2 focus:ring-blue-500 
                   disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}