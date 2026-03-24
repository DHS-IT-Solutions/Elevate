import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level}] [routes/index]`
  const logFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined ? logFn(prefix, message, data) : logFn(prefix, message)
}

const router = Router()
log('DEBUG', 'Router initialized')

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/status', (req: Request, res: Response) => {
  log('DEBUG', 'GET /status called')
  res.json({ status: 'API is running' })
  log('INFO', 'GET /status responded successfully')
})

// ── Protected routes ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id ?? 'unknown'
  log('DEBUG', `GET /me called`, { userId })

  try {
    if (!req.user) {
      log('WARN', 'GET /me reached handler but req.user is undefined — auth middleware may have failed silently')
      return res.status(401).json({ error: 'User not authenticated' })
    }

    log('INFO', 'GET /me returning user data', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
    })

    res.json({ user: req.user })
    log('DEBUG', `GET /me responded successfully for userId=${userId}`)

  } catch (err) {
    log('ERROR', `GET /me threw an unexpected error for userId=${userId}`, err)
    next(err) // forward to errorHandler instead of swallowing
  }
})

log('DEBUG', 'All routes registered')
export default router