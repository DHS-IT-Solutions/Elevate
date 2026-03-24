// components/leaves/ApprovalButtons.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, X } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [ApprovalButtons] ${message}`, data)
    : fn(`[${ts}] [${level}] [ApprovalButtons] ${message}`)
}

interface ApprovalButtonsProps {
  leaveId: string
  onSuccess?: () => void
}

export default function ApprovalButtons({ leaveId, onSuccess }: ApprovalButtonsProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  // ── Approve ─────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    log('INFO', 'Approve button clicked', { leaveId })
    setLoading(true)
    setActionError(null)

    const approvedAt = new Date().toISOString()
    log('DEBUG', 'Updating leave status to approved', { leaveId, approvedAt })

    try {
      const { error } = await supabase
        .from('leaves')
        .update({
          status: 'approved',
          approved_at: approvedAt,
        })
        .eq('id', leaveId)

      if (error) {
        log('ERROR', 'Failed to approve leave', {
          leaveId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        setActionError(`Failed to approve: ${error.message}`)
        return
      }

      log('INFO', 'Leave approved successfully', { leaveId, approvedAt })

      if (onSuccess) {
        log('DEBUG', 'Calling onSuccess() callback after approval')
        onSuccess()
      } else {
        log('DEBUG', 'No onSuccess callback provided — skipping')
      }

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleApprove()', {
        leaveId,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while approving')
    } finally {
      setLoading(false)
    }
  }

  // ── Reject ──────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    const trimmedReason = rejectionReason.trim()

    if (!trimmedReason) {
      log('WARN', 'handleReject() blocked — rejection reason is empty', { leaveId })
      alert('Please provide a rejection reason')
      return
    }

    log('INFO', 'Confirming leave rejection', {
      leaveId,
      reasonLength: trimmedReason.length,
      reasonPreview: trimmedReason.slice(0, 60) + (trimmedReason.length > 60 ? '…' : ''),
    })

    setLoading(true)
    setActionError(null)

    try {
      const { error } = await supabase
        .from('leaves')
        .update({
          status: 'rejected',
          rejection_reason: trimmedReason,
        })
        .eq('id', leaveId)

      if (error) {
        log('ERROR', 'Failed to reject leave', {
          leaveId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        setActionError(`Failed to reject: ${error.message}`)
        return
      }

      log('INFO', 'Leave rejected successfully', {
        leaveId,
        reasonPreview: trimmedReason.slice(0, 60) + (trimmedReason.length > 60 ? '…' : ''),
      })

      setShowRejectModal(false)
      setRejectionReason('')

      if (onSuccess) {
        log('DEBUG', 'Calling onSuccess() callback after rejection')
        onSuccess()
      } else {
        log('DEBUG', 'No onSuccess callback provided — skipping')
      }

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleReject()', {
        leaveId,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while rejecting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white 
                     py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-green-700 
                     disabled:opacity-50 transition-colors"
        >
          <Check className="w-4 h-4" />
          Approve
        </button>

        <button
          onClick={() => {
            log('DEBUG', 'Reject button clicked — opening rejection modal', { leaveId })
            setActionError(null)
            setShowRejectModal(true)
          }}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white 
                     py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-red-700 
                     disabled:opacity-50 transition-colors"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>

      {/* Inline error banner — shown below buttons when modal is closed */}
      {actionError && !showRejectModal && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {actionError}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Leave Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this leave request:
            </p>

            {/* Modal-level error banner */}
            {actionError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {actionError}
              </div>
            )}

            <textarea
              value={rejectionReason}
              onChange={e => {
                setRejectionReason(e.target.value)
                // Clear stale errors as the user types a new reason
                if (actionError) setActionError(null)
              }}
              rows={4}
              placeholder="e.g., Not enough coverage, busy period, etc."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  log('DEBUG', 'Reject modal cancelled by user', { leaveId })
                  setShowRejectModal(false)
                  setRejectionReason('')
                  setActionError(null)
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border 
                           border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 
                           rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}