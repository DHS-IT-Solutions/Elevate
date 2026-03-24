import { Request, Response, NextFunction } from 'express'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level}] [auth.middleware]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined ? logFn(prefix, message, data) : logFn(prefix, message)
}

// ── Supabase client init ──────────────────────────────────────────────────────
log('DEBUG', 'Reading Supabase environment variables')

const supabaseUrl: string = process.env.SUPABASE_URL!
const supabaseKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) {
  log('ERROR', 'SUPABASE_URL is not set in environment variables')
  throw new Error('Missing env var: SUPABASE_URL')
}
if (!supabaseKey) {
  log('ERROR', 'SUPABASE_KEY is not set in environment variables')
  throw new Error('Missing env var: SUPABASE_KEY')
}

log('INFO', `Supabase URL: ${supabaseUrl}`)
log('DEBUG', 'SUPABASE_KEY loaded (value hidden)')

export const supabase: SupabaseClient = (() => {
  try {
    const client = createClient(supabaseUrl, supabaseKey)
    log('INFO', 'Supabase client created successfully in auth middleware')
    return client
  } catch (err) {
    log('ERROR', 'Failed to create Supabase client', err)
    throw err
  }
})()

// ── Middleware ────────────────────────────────────────────────────────────────
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const requestId = `${req.method} ${req.path}`
  log('DEBUG', `[${requestId}] authenticate() called`)

  try {
    const authHeader = req.headers.authorization
    log('DEBUG', `[${requestId}] Authorization header present: ${!!authHeader}`)

    if (!authHeader) {
      log('WARN', `[${requestId}] No Authorization header found`)
      return res.status(401).json({ error: 'No token provided' })
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      log('WARN', `[${requestId}] Malformed Authorization header: expected "Bearer <token>", got "${parts[0]} ..."`)
      return res.status(401).json({ error: 'Malformed authorization header' })
    }

    const token = parts[1]
    log('DEBUG', `[${requestId}] Token extracted (length: ${token.length})`)

    log('DEBUG', `[${requestId}] Calling supabase.auth.getUser()`)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error) {
      log('WARN', `[${requestId}] Supabase returned an error for token validation`, {
        message: error.message,
        status: error.status,
      })
      return res.status(401).json({ error: 'Invalid token' })
    }

    if (!user) {
      log('WARN', `[${requestId}] Token valid but no user returned from Supabase`)
      return res.status(401).json({ error: 'Invalid token' })
    }

    log('INFO', `[${requestId}] Authentication successful`, {
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    req.user = user
    log('DEBUG', `[${requestId}] req.user set, calling next()`)
    next()

  } catch (err) {
    log('ERROR', `[${requestId}] Unexpected error in authenticate()`, err)
    next(err)
  }
}