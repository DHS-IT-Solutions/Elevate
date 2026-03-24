import { Resend } from 'resend'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [email] ${message}`, data)
    : fn(`[${ts}] [${level}] [email] ${message}`)
}

// ── Resend client init ────────────────────────────────────────────────────────
const apiKey = process.env.RESEND_API_KEY

if (!apiKey) {
  log('ERROR', 'RESEND_API_KEY is not set — email sending will fail at runtime')
}

log('DEBUG', `Resend client initializing`, { keyPresent: !!apiKey })
const resend = new Resend(apiKey)

// ── sendTimesheetEmail ────────────────────────────────────────────────────────
export async function sendTimesheetEmail(to: string, subject: string, body: string) {
  log('INFO', 'sendTimesheetEmail() called', {
    to,
    subject,
    bodyLength: body.length,
  })

  if (!to || !to.includes('@')) {
    log('WARN', 'sendTimesheetEmail() called with invalid recipient address', { to })
    throw new Error(`Invalid recipient email address: "${to}"`)
  }

  if (!subject.trim()) {
    log('WARN', 'sendTimesheetEmail() called with empty subject')
  }

  if (!body.trim()) {
    log('WARN', 'sendTimesheetEmail() called with empty body')
  }

  if (!apiKey) {
    log('ERROR', 'sendTimesheetEmail() aborting — RESEND_API_KEY is not set')
    throw new Error('Cannot send email: RESEND_API_KEY is not configured')
  }

  try {
    log('DEBUG', 'Calling resend.emails.send()', { to, subject })

    const result = await resend.emails.send({
      from: 'noreply@yourdomain.com',
      to,
      subject,
      text: body,
    })

    if (result.error) {
      log('ERROR', 'Resend API returned an error', {
        to,
        subject,
        errorName: result.error.name,
        errorMessage: result.error.message,
      })
      throw new Error(`Resend error: ${result.error.message}`)
    }

    log('INFO', 'Email sent successfully', {
      to,
      subject,
      messageId: result.data?.id ?? 'unknown',
    })

    return result

  } catch (err) {
    // Re-throw Resend API errors (already logged above) and unexpected exceptions
    if (err instanceof Error && err.message.startsWith('Resend error:')) {
      throw err
    }
    log('ERROR', 'Unexpected exception in sendTimesheetEmail()', {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}