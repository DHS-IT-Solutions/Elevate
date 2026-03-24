// components/leaves/LeaveRequestForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Calendar, Clock } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [LeaveRequestForm] ${message}`, data)
    : fn(`[${ts}] [${level}] [LeaveRequestForm] ${message}`)
}

interface LeaveRequestFormProps {
  employeeId: string
  onSuccess?: () => void
}

export default function LeaveRequestForm({ employeeId, onSuccess }: LeaveRequestFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    leave_type: 'annual_leave',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_period: 'morning',
    reason: '',
  })

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    log('INFO', 'Leave request form submitted', {
      employeeId,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.is_half_day ? form.start_date : form.end_date,
      is_half_day: form.is_half_day,
      half_day_period: form.is_half_day ? form.half_day_period : null,
      hasReason: !!form.reason,
    })

    try {
      // ── Step 1: date validation ───────────────────────────────────────────
      const start = new Date(form.start_date)
      const end = form.is_half_day ? start : new Date(form.end_date)

      if (isNaN(start.getTime())) {
        const msg = 'Start date is invalid'
        log('WARN', msg, { raw_start_date: form.start_date })
        setError(msg)
        setLoading(false)
        return
      }

      if (!form.is_half_day) {
        if (isNaN(end.getTime())) {
          const msg = 'End date is invalid'
          log('WARN', msg, { raw_end_date: form.end_date })
          setError(msg)
          setLoading(false)
          return
        }

        if (end < start) {
          const msg = 'End date cannot be before start date'
          log('WARN', msg, { start_date: form.start_date, end_date: form.end_date })
          setError(msg)
          setLoading(false)
          return
        }
      }

      // ── Step 2: calculate total days ────────────────────────────────────
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      const totalDays = form.is_half_day ? 0.5 : diffDays

      log('DEBUG', 'Total days calculated', {
        start_date: form.start_date,
        end_date: form.is_half_day ? form.start_date : form.end_date,
        diffDays,
        totalDays,
        is_half_day: form.is_half_day,
      })

      if (totalDays <= 0) {
        const msg = 'Total days must be greater than zero'
        log('WARN', msg, { totalDays, start_date: form.start_date, end_date: form.end_date })
        setError(msg)
        setLoading(false)
        return
      }

      // ── Step 3: resolve manager as approver ─────────────────────────────
      log('DEBUG', 'Fetching manager_id for approver assignment', { employeeId })

      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('manager_id')
        .eq('id', employeeId)
        .single()

      if (empError) {
        if (empError.code === 'PGRST116') {
          log('WARN', 'No employee record found for employeeId — leave will have no approver', {
            employeeId,
            hint: 'Employee row may be missing or employeeId prop is wrong',
          })
        } else {
          log('ERROR', 'Failed to fetch employee manager_id', {
            employeeId,
            code: empError.code,
            message: empError.message,
            details: empError.details,
          })
        }
        // Non-fatal — proceed with null approver_id rather than blocking submission
      } else if (!emp?.manager_id) {
        log('WARN', 'Employee has no manager_id — leave will be submitted with no approver', {
          employeeId,
          hint: 'Assign a manager to this employee so leave requests can be routed',
        })
      } else {
        log('DEBUG', 'Approver (manager) resolved', {
          employeeId,
          approverId: emp.manager_id,
        })
      }

      // ── Step 4: insert leave record ──────────────────────────────────────
      const insertPayload = {
        employee_id: employeeId,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.is_half_day ? form.start_date : form.end_date,
        total_days: totalDays,
        is_half_day: form.is_half_day,
        half_day_period: form.is_half_day ? form.half_day_period : null,
        reason: form.reason || null,
        status: 'pending',
        approver_id: emp?.manager_id || null,
      }

      log('DEBUG', 'Inserting leave record', insertPayload)

      const { data: inserted, error: insertError } = await supabase
        .from('leaves')
        .insert(insertPayload)
        .select()

      if (insertError) {
        log('ERROR', 'Failed to insert leave request', {
          employeeId,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        })
        setError(insertError.message)
        return
      }

      log('INFO', 'Leave request submitted successfully', {
        leaveId: inserted?.[0]?.id ?? 'unknown',
        employeeId,
        leave_type: form.leave_type,
        start_date: insertPayload.start_date,
        end_date: insertPayload.end_date,
        total_days: totalDays,
        approver_id: insertPayload.approver_id ?? 'none',
      })

      // ── Step 5: navigate away ────────────────────────────────────────────
      if (onSuccess) {
        log('DEBUG', 'Calling onSuccess() callback')
        onSuccess()
      } else {
        log('DEBUG', 'No onSuccess callback — navigating to /leaves')
        router.push('/leaves')
      }

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleSubmit()', {
        employeeId,
        error: err instanceof Error ? err.message : String(err),
      })
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Leave Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type *</label>
        <select
          value={form.leave_type}
          onChange={e => {
            log('DEBUG', 'leave_type changed', { value: e.target.value })
            setForm(f => ({ ...f, leave_type: e.target.value }))
          }}
          required
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none 
                     focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="annual_leave">Annual Leave</option>
          <option value="sick_leave">Sick Leave</option>
          <option value="work_from_home">Work From Home</option>
          <option value="unpaid_leave">Unpaid Leave</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Half Day Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="half_day"
          checked={form.is_half_day}
          onChange={e => {
            log('DEBUG', 'is_half_day toggled', { value: e.target.checked })
            setForm(f => ({ ...f, is_half_day: e.target.checked }))
          }}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="half_day" className="text-sm font-medium text-gray-700">
          Half Day
        </label>
      </div>

      {/* Half Day Period */}
      {form.is_half_day && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="morning"
                checked={form.half_day_period === 'morning'}
                onChange={e => {
                  log('DEBUG', 'half_day_period changed', { value: e.target.value })
                  setForm(f => ({ ...f, half_day_period: e.target.value }))
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Morning</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="afternoon"
                checked={form.half_day_period === 'afternoon'}
                onChange={e => {
                  log('DEBUG', 'half_day_period changed', { value: e.target.value })
                  setForm(f => ({ ...f, half_day_period: e.target.value }))
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Afternoon</span>
            </label>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Start Date *
          </label>
          <input
            type="date"
            value={form.start_date}
            onChange={e => {
              log('DEBUG', 'start_date changed', { value: e.target.value })
              setForm(f => ({ ...f, start_date: e.target.value }))
            }}
            required
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none 
                       focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {!form.is_half_day && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              End Date *
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => {
                log('DEBUG', 'end_date changed', { value: e.target.value })
                setForm(f => ({ ...f, end_date: e.target.value }))
              }}
              required
              min={form.start_date || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none 
                         focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
        <textarea
          value={form.reason}
          onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none 
                     focus:ring-2 focus:ring-blue-500 text-sm resize-none"
          placeholder="Why do you need this leave?"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium 
                   hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Leave Request'}
      </button>
    </form>
  )
}