'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined ? fn(`[${ts}] [${level}] [useAuth] ${message}`, data) : fn(`[${ts}] [${level}] [useAuth] ${message}`)
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'useAuth mounted — fetching initial user')

    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          log('WARN', 'supabase.auth.getUser() returned an error', {
            message: error.message,
            status: error.status,
          })
          setUser(null)
        } else if (user) {
          log('INFO', 'Initial user loaded', { userId: user.id, email: user.email, role: user.role })
          setUser(user)
        } else {
          log('DEBUG', 'No active session found on mount')
          setUser(null)
        }
      } catch (err) {
        log('ERROR', 'Unexpected exception in getUser()', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    log('DEBUG', 'Subscribing to auth state changes')
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      log('INFO', `Auth state changed: event=${event}`, {
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        expiresAt: session?.expires_at ?? null,
      })

      if (!session?.user) {
        log('DEBUG', `Auth event "${event}" resulted in no user — clearing state`)
      }

      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      log('DEBUG', 'useAuth unmounting — unsubscribing from auth state changes')
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    log('INFO', 'signOut() called')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        log('ERROR', 'signOut() failed', { message: error.message, status: error.status })
      } else {
        log('INFO', 'signOut() succeeded')
      }
    } catch (err) {
      log('ERROR', 'Unexpected exception during signOut()', err)
    }
  }

  return { user, loading, signOut }
}