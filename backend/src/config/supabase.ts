import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const timestamp = new Date().toISOString()
  const formatted = `[${timestamp}] [${level}] [supabase] ${message}`
  if (data !== undefined) {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](formatted, data)
  } else {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](formatted)
  }
}

log('DEBUG', 'Loading Supabase environment variables')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  log('ERROR', 'SUPABASE_URL is missing from environment variables')
  throw new Error('Missing Supabase environment variable: SUPABASE_URL')
}

if (!supabaseServiceRoleKey) {
  log('ERROR', 'SUPABASE_SERVICE_ROLE_KEY is missing from environment variables')
  throw new Error('Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY')
}

log('INFO', `Supabase URL loaded: ${supabaseUrl}`)
log('DEBUG', 'Supabase service role key loaded (value hidden)')

let supabase
try {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  log('INFO', 'Supabase client created successfully')
} catch (err) {
  log('ERROR', 'Failed to create Supabase client', err)
  throw err
}

export { supabase }