import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [supabase/middleware] ${message}`, data)
    : fn(`[${ts}] [${level}] [supabase/middleware] ${message}`)
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  log('DEBUG', `updateSession called`, { pathname, method: request.method })

  // ── Env var validation ──────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    log('ERROR', 'NEXT_PUBLIC_SUPABASE_URL is not set — cannot create Supabase client')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!supabaseAnonKey) {
    log('ERROR', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — cannot create Supabase client')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  let supabaseResponse = NextResponse.next({ request })
  let cookiesSet = 0
  let cookiesRead = 0

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      const all = request.cookies.getAll()
      cookiesRead = all.length
      log('DEBUG', `Cookie getAll() called`, { count: all.length, pathname })
      return all
    },
    setAll(cookiesToSet) {
      log('DEBUG', `Cookie setAll() called`, { count: cookiesToSet.length, pathname })
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
      supabaseResponse = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) => {
        supabaseResponse.cookies.set(name, value, options)
        cookiesSet++
        log('DEBUG', `Cookie SET`, { name, pathname })
      })
    },
  }

  // ── Create Supabase client ──────────────────────────────────────────────────
  log('DEBUG', 'Creating Supabase SSR client')
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: cookieMethods })

  // ── Session check ───────────────────────────────────────────────────────────
  log('DEBUG', 'Calling supabase.auth.getUser()')
  let user = null

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      log('WARN', 'supabase.auth.getUser() returned an error', {
        message: error.message,
        status: error.status,
        pathname,
      })
    } else {
      user = data.user
      if (user) {
        log('INFO', 'Session valid', { userId: user.id, email: user.email, pathname })
      } else {
        log('DEBUG', 'No active session', { pathname })
      }
    }
  } catch (err) {
    log('ERROR', 'Unexpected exception during supabase.auth.getUser()', {
      error: err instanceof Error ? err.message : String(err),
      pathname,
    })
    // Fail open — do not crash middleware, fall through to route guards
  }

  log('DEBUG', `Cookie stats after getUser()`, { read: cookiesRead, set: cookiesSet })

  // ── Route guards ────────────────────────────────────────────────────────────
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    log('WARN', 'Unauthenticated access to /dashboard — redirecting to /login', { from: pathname })
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    log('INFO', 'Authenticated user on auth page — redirecting to /dashboard', {
      userId: user.id,
      from: pathname,
    })
    return NextResponse.redirect(url)
  }

  log('DEBUG', 'Request passed through middleware', {
    pathname,
    authenticated: !!user,
    userId: user?.id ?? 'anonymous',
  })

  return supabaseResponse
}