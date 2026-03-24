import { User } from '@supabase/supabase-js'

declare global {
  namespace Express {
    interface Request {
      user?: User
      /**
       * Request ID for tracing — set by requestLogger middleware if used.
       * Format: "<METHOD> <path> @ <timestamp>"
       */
      requestId?: string
    }
  }
}

export {}