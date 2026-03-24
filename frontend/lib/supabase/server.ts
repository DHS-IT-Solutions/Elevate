import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [supabase/server] ${message}`, data)
    : fn(`[${ts}] [${level}] [supabase/server] ${message}`)
}

export async function createServerClient() {
  log('DEBUG', 'createServerClient() called — reading cookie store')

  // ── Env var validation ──────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    log('ERROR', 'NEXT_PUBLIC_SUPABASE_URL is not set')
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!supabaseAnonKey) {
    log('ERROR', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>>

  try {
    cookieStore = await cookies()
    log('DEBUG', 'Cookie store acquired successfully')
  } catch (err) {
    log('ERROR', 'Failed to acquire cookie store — createServerClient() called outside a request context?', {
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  log('DEBUG', 'Building Supabase server client with typed Database schema')

  const client = createSupabaseServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll()
          log('DEBUG', `Cookie getAll()`, { count: all.length })
          return all
        },
        setAll(cookiesToSet) {
          log('DEBUG', `Cookie setAll() called`, { count: cookiesToSet.length })
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              log('DEBUG', `Cookie SET`, { name })
            })
          } catch (err) {
            // In a Server Component, cookies() is read-only — this is expected and safe to ignore.
            // In a Route Handler or Server Action, this should not throw.
            log('DEBUG', 'Cookie setAll() suppressed (likely a Server Component read-only context)', {
              error: err instanceof Error ? err.message : String(err),
            })
          }
        },
      },
    }
  )

  log('INFO', 'Supabase server client created successfully')
  return client
}