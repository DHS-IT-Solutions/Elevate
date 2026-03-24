import dotenv from 'dotenv'
dotenv.config()


import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { logger } from './utils/logger'
import routes from './routes'
import { errorHandler } from './middleware/errorHandler'

logger.info('[startup] dotenv loaded')

const app = express()
const PORT = process.env.PORT || 5000
const NODE_ENV = process.env.NODE_ENV || 'development'
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']

logger.info(`[startup] PORT=${PORT}`)
logger.info(`[startup] NODE_ENV=${NODE_ENV}`)
logger.info(`[startup] ALLOWED_ORIGINS=${ALLOWED_ORIGINS.join(', ')}`)
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set ✓' : 'Not set ✗')
console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set ✓' : 'Not set ✗')

// ── Request logger ────────────────────────────────────────────────────────────
// Logs every incoming request and its response status/duration
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  const requestId = `${req.method} ${req.path} @ ${new Date().toISOString()}`
  req.requestId = requestId

  logger.info(`[request] --> ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
  })

  res.on('finish', () => {
    const duration = Date.now() - start
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info'

    logger[level](`[request] <-- ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, {
      statusCode: res.statusCode,
      duration,
      requestId,
    })
  })

  next()
})

// ── Security & parsing middleware ─────────────────────────────────────────────
logger.info('[startup] Applying helmet, compression, cors, json, urlencoded middleware')

app.use(helmet())
app.use(compression())

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

logger.info('[startup] All middleware applied')

// ── Routes ────────────────────────────────────────────────────────────────────
logger.info('[startup] Registering /api routes')
app.use('/api', routes)
logger.info('[startup] /api routes registered')

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  logger.debug('[health] Health check called')
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── 404 handler (must come before errorHandler) ───────────────────────────────
app.use((req: Request, res: Response) => {
  logger.warn(`[request] 404 Not Found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  })
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` })
})

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorHandler)
logger.info('[startup] Error handler registered')

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`[startup] ✅ Server running on port ${PORT}`)
  logger.info(`[startup] Environment: ${NODE_ENV}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.warn('[shutdown] SIGTERM received — closing server gracefully')
  server.close(() => {
    logger.info('[shutdown] Server closed cleanly')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.warn('[shutdown] SIGINT received — closing server gracefully')
  server.close(() => {
    logger.info('[shutdown] Server closed cleanly')
    process.exit(0)
  })
})

process.on('uncaughtException', (err) => {
  logger.error('[fatal] Uncaught exception — server will exit', {
    message: err.message,
    stack: err.stack,
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('[fatal] Unhandled promise rejection', { reason })
  process.exit(1)
})