// components/leaves/LeaveCard.tsx
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import type { LeaveWithEmployee } from '@/types/leave'
import { Calendar, Clock, User } from 'lucide-react'

interface LeaveCardProps {
  leave: LeaveWithEmployee
  showEmployee?: boolean
  showApprover?: boolean
}

export default function LeaveCard({ leave, showEmployee = true, showApprover = false }: LeaveCardProps) {
  const employeeName = leave.employee
    ? `${leave.employee.first_name} ${leave.employee.last_name}`
    : 'Unknown'

  const approverName = leave.approver
    ? `${leave.approver.first_name} ${leave.approver.last_name}`
    : 'Pending'

  const statusColor = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  }[leave.status ?? 'pending']

  const leaveTypeLabel = leave.leave_type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <Link href={`/leaves/${leave.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md 
                      hover:border-gray-300 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {showEmployee && leave.employee && (
              <Avatar
                name={employeeName}
                imageUrl={leave.employee.profile_picture_url}
                size="sm"
              />
            )}
            <div>
              {showEmployee && (
                <p className="text-sm font-semibold text-gray-900">{employeeName}</p>
              )}
              <p className={`text-xs font-medium ${showEmployee ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}>
                {leaveTypeLabel}
              </p>
            </div>
          </div>

          <span className={`text-xs px-2 py-1 rounded-full border font-medium capitalize ${statusColor}`}>
            {leave.status}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>
              {formatDate(leave.start_date)}
              {leave.start_date !== leave.end_date && ` – ${formatDate(leave.end_date)}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>
              {leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}
              {leave.is_half_day && ` (${leave.half_day_period})`}
            </span>
          </div>

          {showApprover && leave.approver && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span>Approver: {approverName}</span>
            </div>
          )}
        </div>

        {leave.reason && (
          <p className="text-sm text-gray-500 mt-3 line-clamp-2 italic">
            "{leave.reason}"
          </p>
        )}

        {leave.status === 'rejected' && leave.rejection_reason && (
          <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-2">
            <p className="text-xs text-red-700">
              <strong>Rejection reason:</strong> {leave.rejection_reason}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}