// lib/services/emailService.ts
import { createClient } from '@/lib/supabase/client'

/**
 * Dedicated Email Service
 * Handles all email notifications for the DHS Elevate system
 * 
 * Future expansions:
 * - Leave request notifications
 * - Document approval notifications
 * - Announcement notifications
 * - Birthday/anniversary reminders
 * - Performance review reminders
 */

export interface EmailParams {
  to: string
  recipientId: string
  subject: string
  body: string
  notificationType: string
  metadata?: Record<string, any>
}

/**
 * Send an email notification
 */
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    const { error } = await supabase.from('email_notifications').insert({
      recipient_id: params.recipientId,
      recipient_email: params.to,
      notification_type: params.notificationType,
      subject: params.subject,
      body: params.body,
      status: 'pending',
      metadata: params.metadata || null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('[EmailService] Failed to queue email:', error)
      return { success: false, error: error.message }
    }

    console.log('[EmailService] Email queued successfully:', {
      to: params.to,
      type: params.notificationType,
      subject: params.subject,
    })

    return { success: true }
  } catch (err) {
    console.error('[EmailService] Exception:', err)
    return { success: false, error: String(err) }
  }
}

// ============================================================================
// TIMESHEET EMAIL TEMPLATES
// ============================================================================

/**
 * Send timesheet submission notification to approver
 */
export async function sendTimesheetSubmissionEmail(params: {
  approverEmail: string
  approverId: string
  employeeName: string
  weekStart: string
  weekEnd: string
  totalHours: number
}) {
  const subject = `⏱️ Timesheet Submitted for Approval - ${params.employeeName}`
  
  const body = `
Hello,

${params.employeeName} has submitted their timesheet for approval.

📅 Week: ${params.weekStart} to ${params.weekEnd}
⏰ Total Hours: ${params.totalHours}h

Please review and approve the timesheet at your earliest convenience.

Login to DHS Elevate to review: ${window.location.origin}/timesheets

---
This is an automated notification from DHS Elevate.
  `.trim()

  return sendEmail({
    to: params.approverEmail,
    recipientId: params.approverId,
    subject,
    body,
    notificationType: 'timesheet_submission',
    metadata: {
      employeeName: params.employeeName,
      weekStart: params.weekStart,
      weekEnd: params.weekEnd,
      totalHours: params.totalHours,
    },
  })
}

/**
 * Send timesheet approval notification to employee
 */
export async function sendTimesheetApprovalEmail(params: {
  employeeEmail: string
  employeeId: string
  approverName: string
  weekStart: string
  weekEnd: string
  totalHours: number
}) {
  const subject = `✅ Timesheet Approved - Week ${params.weekStart}`
  
  const body = `
Hello,

Your timesheet has been approved by ${params.approverName}.

📅 Week: ${params.weekStart} to ${params.weekEnd}
⏰ Total Hours: ${params.totalHours}h
✅ Status: Approved

You can view your approved timesheet at: ${window.location.origin}/timesheets

---
This is an automated notification from DHS Elevate.
  `.trim()

  return sendEmail({
    to: params.employeeEmail,
    recipientId: params.employeeId,
    subject,
    body,
    notificationType: 'timesheet_approval',
    metadata: {
      approverName: params.approverName,
      weekStart: params.weekStart,
      weekEnd: params.weekEnd,
      totalHours: params.totalHours,
    },
  })
}

/**
 * Send timesheet rejection notification to employee
 */
export async function sendTimesheetRejectionEmail(params: {
  employeeEmail: string
  employeeId: string
  approverName: string
  weekStart: string
  weekEnd: string
  reason?: string
}) {
  const subject = `❌ Timesheet Requires Revision - Week ${params.weekStart}`
  
  const body = `
Hello,

Your timesheet has been returned for revision by ${params.approverName}.

📅 Week: ${params.weekStart} to ${params.weekEnd}
${params.reason ? `\n💬 Reason: ${params.reason}\n` : ''}
Please review the comments and resubmit your timesheet.

View timesheet: ${window.location.origin}/timesheets

---
This is an automated notification from DHS Elevate.
  `.trim()

  return sendEmail({
    to: params.employeeEmail,
    recipientId: params.employeeId,
    subject,
    body,
    notificationType: 'timesheet_rejection',
    metadata: {
      approverName: params.approverName,
      weekStart: params.weekStart,
      weekEnd: params.weekEnd,
      reason: params.reason,
    },
  })
}

// ============================================================================
// LEAVE EMAIL TEMPLATES (Future Implementation)
// ============================================================================

export async function sendLeaveRequestEmail(params: {
  approverEmail: string
  approverId: string
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
}) {
  const subject = `🏖️ Leave Request - ${params.employeeName}`
  
  const body = `
Hello,

${params.employeeName} has submitted a leave request.

📅 Type: ${params.leaveType}
📅 From: ${params.startDate}
📅 To: ${params.endDate}
⏰ Days: ${params.days}

Please review and respond to this leave request.

Login to DHS Elevate: ${window.location.origin}/calendar

---
This is an automated notification from DHS Elevate.
  `.trim()

  return sendEmail({
    to: params.approverEmail,
    recipientId: params.approverId,
    subject,
    body,
    notificationType: 'leave_request',
    metadata: params,
  })
}

// ============================================================================
// ANNOUNCEMENT EMAIL TEMPLATES (Future Implementation)
// ============================================================================

export async function sendAnnouncementEmail(params: {
  employeeEmail: string
  employeeId: string
  announcementTitle: string
  announcementContent: string
  priority: string
}) {
  const priorityEmoji = {
    high: '🔴',
    normal: '🔵',
    low: '⚪',
  }[params.priority] || '🔵'

  const subject = `${priorityEmoji} New Announcement: ${params.announcementTitle}`
  
  const body = `
Hello,

A new announcement has been posted:

${priorityEmoji} ${params.announcementTitle}

${params.announcementContent}

View all announcements: ${window.location.origin}/announcements

---
This is an automated notification from DHS Elevate.
  `.trim()

  return sendEmail({
    to: params.employeeEmail,
    recipientId: params.employeeId,
    subject,
    body,
    notificationType: 'announcement',
    metadata: {
      announcementTitle: params.announcementTitle,
      priority: params.priority,
    },
  })
}

// ============================================================================
// DOCUMENT EMAIL TEMPLATES (Future Implementation)
// ============================================================================

export async function sendDocumentAcknowledgmentReminder(params: {
  employeeEmail: string
  employeeId: string
  documentTitle: string
  dueDate: string
}) {
  const subject = `📄 Document Acknowledgment Required: ${params.documentTitle}`
  
  const body = `
Hello,

You have a document that requires acknowledgment:

📄 Document: ${params.documentTitle}
⏰ Due Date: ${params.dueDate}

Please review and acknowledge this document at your earliest convenience.

View documents: ${window.location.origin}/documents

---
This is an automated notification from DHS Elevate.
  `.trim()

  return sendEmail({
    to: params.employeeEmail,
    recipientId: params.employeeId,
    subject,
    body,
    notificationType: 'document_acknowledgment_reminder',
    metadata: {
      documentTitle: params.documentTitle,
      dueDate: params.dueDate,
    },
  })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format date for email display
 */
export function formatEmailDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Get email status for a notification
 */
export async function getEmailStatus(notificationId: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('email_notifications')
    .select('status, sent_at, error_message')
    .eq('id', notificationId)
    .single()

  if (error) {
    console.error('[EmailService] Failed to get email status:', error)
    return null
  }

  return data
}