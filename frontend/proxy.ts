// proxy.ts — UPDATED: No onboarding, admin creates all users
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  message: string,
  data?: Record<string, unknown>
) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level}] [proxy]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined ? logFn(prefix, message, data) : logFn(prefix, message)
}

// ── Protected path check ──────────────────────────────────────────────────────
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/company',
  '/leaves',
  '/calendar',
  '/settings',
  '/announcements',
  '/timesheets',
  '/documents',
  '/profile',
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

// ── Main middleware ───────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname, href } = request.nextUrl
  log('DEBUG', `Incoming request`, { method: request.method, pathname, href })

  // ── Validate env vars ───────────────────────────────────────────────────────
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

  // ── Build base response ─────────────────────────────────────────────────────
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // ── Supabase SSR client with cookie logging ─────────────────────────────────
  log('DEBUG', 'Creating Supabase SSR client')
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const value = request.cookies.get(name)?.value
        log('DEBUG', `Cookie GET`, { name, found: value !== undefined })
        return value
      },
      set(name: string, value: string, options: any) {
        log('DEBUG', `Cookie SET`, { name })
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        log('DEBUG', `Cookie REMOVE`, { name })
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // ── Session check ───────────────────────────────────────────────────────────
  log('DEBUG', 'Calling supabase.auth.getUser()')
  let user = null

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      // PGRST / network errors — distinct from simply being logged out
      log('WARN', 'supabase.auth.getUser() returned an error', {
        message: error.message,
        status: error.status,
        pathname,
      })
    } else {
      user = data.user
      if (user) {
        log('INFO', 'Authenticated user found', {
          userId: user.id,
          email: user.email,
          role: user.role,
          pathname,
        })
      } else {
        log('DEBUG', 'No authenticated user (session absent or expired)', { pathname })
      }
    }
  } catch (err) {
    log('ERROR', 'Unexpected exception during supabase.auth.getUser()', {
      error: err instanceof Error ? err.message : String(err),
      pathname,
    })
    // Fail open — don't crash the middleware, fall through to redirect logic
  }

  // ── Route guard ─────────────────────────────────────────────────────────────
  const protected_ = isProtectedPath(pathname)
  log('DEBUG', 'Route classification', { pathname, isProtected: protected_, authenticated: !!user })

  if (!user && protected_) {
    const loginUrl = new URL('/login', request.url)
    log('WARN', 'Unauthenticated access to protected route — redirecting to /login', {
      attemptedPath: pathname,
      redirectTo: loginUrl.pathname,
    })
    return NextResponse.redirect(loginUrl)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    // Already logged in — redirect away from auth pages to avoid confusion
    const dashboardUrl = new URL('/dashboard', request.url)
    log('INFO', 'Authenticated user hit auth page — redirecting to /dashboard', {
      userId: user.id,
      from: pathname,
    })
    return NextResponse.redirect(dashboardUrl)
  }

  log('DEBUG', 'Request allowed through', { pathname, userId: user?.id ?? 'anonymous' })
  return response
}

// ── Matcher config ────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/company/:path*',
    '/leaves/:path*',
    '/calendar/:path*',
    '/settings/:path*',
    '/announcements/:path*',
    '/timesheets/:path*',
    '/documents/:path*',
    '/profile/:path*',
    '/login',
    '/signup',
  ],
}