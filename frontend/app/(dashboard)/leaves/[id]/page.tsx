// app/(dashboard)/leaves/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import ApprovalButtons from '@/components/leaves/ApprovalButtons'
import Avatar from '@/components/shared/Avatar'
import { ArrowLeft, Calendar, Clock, User, FileText } from 'lucide-react'
import Link from 'next/link'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [LeaveDetailPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [LeaveDetailPage] ${message}`)
}

export default function LeaveDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [leave, setLeave] = useState<any | null>(null)
  const [canApprove, setCanApprove] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { hasPermission: canApproveLeaves } = usePermission(PERMISSIONS.LEAVES.APPROVE_TEAM)

  useEffect(() => {
    log('DEBUG', 'LeaveDetailPage mounted', { leaveId: params?.id ?? 'missing' })
    fetchLeave()
  }, [])

  const fetchLeave = async () => {
    try {
      // ── Step 1: validate route param ──────────────────────────────────────
      if (!params?.id || typeof params.id !== 'string') {
        log('WARN', 'Invalid or missing leave ID in route params', {
          params,
          hint: 'This page should only be reachable with a valid UUID in the URL',
        })
        setLoading(false)
        return
      }

      log('DEBUG', 'Fetching leave detail', { leaveId: params.id })

      // ── Step 2: auth ──────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        log('WARN', 'supabase.auth.getUser() error', {
          message: authError.message,
          status: authError.status,
        })
        setLoading(false)
        return
      }

      if (!user) {
        log('WARN', 'No authenticated user — cannot load leave detail')
        setLoading(false)
        return
      }

      log('DEBUG', 'Auth user resolved', { userId: user.id })

      // ── Step 3: resolve current employee (needed for canApprove check) ────
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (empError) {
        if (empError.code === 'PGRST116') {
          log('WARN', 'No employee record found for user', {
            userId: user.id,
            hint: 'User exists in auth but has no employees row',
          })
        } else {
          log('ERROR', 'Failed to fetch employee record', {
            userId: user.id,
            code: empError.code,
            message: empError.message,
          })
        }
        setLoading(false)
        return
      }

      log('DEBUG', 'Current employee resolved', { employeeId: emp.id })

      // ── Step 4: fetch leave with joins ────────────────────────────────────
      const { data: leaveData, error: leaveError } = await supabase
        .from('leaves')
        .select(`
          *,
          employee:employees!leaves_employee_id_fkey(
            id, first_name, last_name, position, profile_picture_url, email
          ),
          approver:employees!leaves_approver_id_fkey(
            id, first_name, last_name
          )
        `)
        .eq('id', params.id)
        .single()

      if (leaveError) {
        if (leaveError.code === 'PGRST116') {
          log('WARN', 'Leave record not found', {
            leaveId: params.id,
            hint: 'The ID in the URL may be invalid, deleted, or RLS is blocking access',
          })
        } else {
          log('ERROR', 'Failed to fetch leave record', {
            leaveId: params.id,
            code: leaveError.code,
            message: leaveError.message,
            details: leaveError.details,
          })
        }
        setLoading(false)
        return
      }

      if (!leaveData) {
        log('WARN', 'Leave query returned no data', { leaveId: params.id })
        setLoading(false)
        return
      }

      // ── Step 5: warn on missing joined data ───────────────────────────────
      if (!leaveData.employee) {
        log('WARN', 'Leave has no joined employee data — will display as "Unknown"', {
          leaveId: params.id,
          employeeId: leaveData.employee_id,
          hint: 'Employee may have been deleted or RLS is blocking the join',
        })
      }

      if (leaveData.approver_id && !leaveData.approver) {
        log('WARN', 'Leave has approver_id but no joined approver data', {
          leaveId: params.id,
          approverId: leaveData.approver_id,
          hint: 'Approver employee row may be missing or RLS is blocking the join',
        })
      }

      // ── Step 6: determine canApprove ──────────────────────────────────────
      const isApprover = leaveData.approver_id === emp.id
      const isPending = leaveData.status === 'pending'
      const approveFlag = canApproveLeaves && isApprover && isPending

      log('INFO', 'Leave detail loaded', {
        leaveId: leaveData.id,
        status: leaveData.status,
        leave_type: leaveData.leave_type,
        employeeId: leaveData.employee_id,
        employeeName: leaveData.employee
          ? `${leaveData.employee.first_name} ${leaveData.employee.last_name}`
          : 'Unknown',
        approverId: leaveData.approver_id ?? 'none',
        canApprove: approveFlag,
        ...(!approveFlag && isApprover && !isPending && {
          canApproveReason: `Status is "${leaveData.status}" — approval actions only shown for pending`,
        }),
        ...(!approveFlag && !isApprover && {
          canApproveReason: `Current employee (${emp.id}) is not the approver (${leaveData.approver_id ?? 'none'})`,
        }),
      })

      setLeave(leaveData)
      setCanApprove(approveFlag)

    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchLeave()', {
        leaveId: params?.id,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-20">Loading...</div>
  }

  if (!leave) {
    return <div className="text-center py-20 text-gray-500">Leave request not found</div>
  }

  const employeeName = leave.employee
    ? `${leave.employee.first_name} ${leave.employee.last_name}`
    : 'Unknown'

  const approverName = leave.approver
    ? `${leave.approver.first_name} ${leave.approver.last_name}`
    : 'Not assigned'

  const statusColor = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    approved: 'bg-green-50  text-green-700  border-green-200',
    rejected: 'bg-red-50    text-red-700    border-red-200',
  }[(leave.status as 'pending' | 'approved' | 'rejected') ?? 'pending']

  return (
    <div className="max-w-3xl">
      <Link
        href="/leaves"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leaves
      </Link>

      <PageHeader
        title="Leave Request Details"
        subtitle={`Request #${leave.id.slice(0, 8)}`}
      />

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <span className={`text-sm px-3 py-1.5 rounded-full border font-medium capitalize ${statusColor}`}>
            {leave.status}
          </span>
          <span className="text-sm text-gray-500">
            Requested on {new Date(leave.created_at).toLocaleDateString('en-GB')}
          </span>
        </div>

        {/* Employee Info */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <Avatar
            name={employeeName}
            imageUrl={leave.employee?.profile_picture_url}
            size="lg"
          />
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{employeeName}</h3>
            <p className="text-sm text-gray-500">
              {leave.employee?.position || leave.employee?.email}
            </p>
          </div>
        </div>

        {/* Leave Details */}
        <div className="space-y-4">
          <DetailRow
            icon={FileText}
            label="Leave Type"
            value={leave.leave_type
              .split('_')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')}
          />
          <DetailRow
            icon={Calendar}
            label="Duration"
            value={`${new Date(leave.start_date).toLocaleDateString('en-GB')} - ${new Date(leave.end_date).toLocaleDateString('en-GB')}`}
          />
          <DetailRow
            icon={Clock}
            label="Total Days"
            value={`${leave.total_days} day${leave.total_days > 1 ? 's' : ''}`}
          />
          {leave.is_half_day && (
            <DetailRow
              icon={Clock}
              label="Half Day"
              value={leave.half_day_period === 'morning' ? 'Morning' : 'Afternoon'}
            />
          )}
          <DetailRow icon={User} label="Approver" value={approverName} />

          {leave.reason && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Reason</p>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {leave.reason}
              </p>
            </div>
          )}

          {leave.status === 'rejected' && leave.rejection_reason && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-red-700 mb-2">Rejection Reason</p>
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                {leave.rejection_reason}
              </p>
            </div>
          )}

          {leave.status === 'approved' && leave.approved_at && (
            <div className="pt-4 border-t border-gray-100 text-sm text-gray-600">
              Approved on {new Date(leave.approved_at).toLocaleDateString('en-GB')} by {approverName}
            </div>
          )}
        </div>
      </div>

      {/* Approval Buttons */}
      {canApprove && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Approval Actions</h3>
          <ApprovalButtons
            leaveId={leave.id}
            onSuccess={() => {
              log('INFO', 'Approval action completed — navigating to /leaves', {
                leaveId: leave.id,
              })
              router.push('/leaves')
              router.refresh()
            }}
          />
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}