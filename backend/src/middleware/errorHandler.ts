import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

// Extend Error to support optional HTTP status and error codes
interface AppError extends Error {
  status?: number
  statusCode?: number
  code?: string
  isOperational?: boolean
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Determine HTTP status — fall back to 500 if not set
  const statusCode = err.status ?? err.statusCode ?? 500
  const isServerError = statusCode >= 500
  const requestId = `${req.method} ${req.path}`
  const isDev = process.env.NODE_ENV === 'development'

  // ── Structured log entry ────────────────────────────────────────────────────
  const logPayload = {
    requestId,
    statusCode,
    errorName: err.name,
    errorCode: err.code ?? 'UNKNOWN',
    message: err.message,
    isOperational: err.isOperational ?? false,
    path: req.path,
    method: req.method,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id ?? 'unauthenticated',
    // Only include stack trace in dev or for unexpected errors
    ...(isDev || isServerError ? { stack: err.stack } : {}),
  }

  if (isServerError) {
    // 5xx — unexpected, needs immediate attention
    logger.error(`[${requestId}] Unhandled server error (${statusCode})`, logPayload)
  } else {
    // 4xx — client error, expected operational failures
    logger.warn(`[${requestId}] Client error (${statusCode}): ${err.message}`, logPayload)
  }

  // ── Response ────────────────────────────────────────────────────────────────
  if (res.headersSent) {
    // Headers already sent — can't write a new response, just pass on
    logger.warn(`[${requestId}] Headers already sent, skipping error response`)
    return next(err)
  }

  res.status(statusCode).json({
    error: isServerError ? 'Internal server error' : err.message,
    code: err.code ?? undefined,
    // Only expose details in development
    ...(isDev && {
      detail: err.message,
      stack: err.stack,
    }),
  })
}