// app/(dashboard)/leaves/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useMyLeaves, usePendingApprovals, useLeaveBalance } from '@/lib/hooks/useLeaves'
import LeaveCard from '@/components/leaves/LeaveCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Clock, CheckCircle2, XCircle, Calendar } from 'lucide-react'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [LeavesPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [LeavesPage] ${message}`)
}

export default function LeavesPage() {
  const { leaves, loading } = useMyLeaves()
  const { leaves: pendingApprovals } = usePendingApprovals()
  const { balances } = useLeaveBalance()
  const [filter, setFilter] = useState<string>('all')
  const { hasPermission: canRequest } = usePermission(PERMISSIONS.LEAVES.REQUEST)
  const { hasPermission: canApprove } = usePermission(PERMISSIONS.LEAVES.APPROVE_TEAM)
  // ── Log hook results once loading settles ─────────────────────────────────
  useEffect(() => {
    if (loading) return
    log('INFO', 'Leave data loaded', {
      total: leaves.length,
      pending: leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
    })
    if (leaves.length === 0) {
      log('DEBUG', 'No leaves returned for this employee — may be first-time user or hook issue')
    }
  }, [loading, leaves])

  useEffect(() => {
    if (pendingApprovals.length > 0) {
      log('INFO', `${pendingApprovals.length} pending approval(s) require attention`, {
        leaveIds: pendingApprovals.map(l => l.id),
      })
    }
  }, [pendingApprovals])

  useEffect(() => {
    if (balances.length === 0 && !loading) {
      log('WARN', 'No leave balance records found — balance cards will not render', {
        hint: 'Leave balances may not have been initialised for this employee or year',
      })
    } else if (balances.length > 0) {
      log('DEBUG', `Loaded ${balances.length} leave balance record(s)`, {
        summary: balances.map(b => ({
          id: b.id,
          remaining: b.remaining,
          used: b.used,
          total: b.total_allocated,
        })),
      })
    }
  }, [balances, loading])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const result = filter === 'all'
      ? leaves
      : leaves.filter(l => l.status === filter)

    if (filter !== 'all') {
      log('DEBUG', `Filter "${filter}" applied — ${result.length}/${leaves.length} leave(s) shown`)
      if (result.length === 0 && leaves.length > 0) {
        log('DEBUG', `No ${filter} leaves found — empty state will render`)
      }
    }

    return result
  }, [leaves, filter])

  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  }

  return (
    <div>
      <PageHeader
        title="My Leaves"
        subtitle="Manage your time off requests"
        action={
          canRequest ? (
            <Link
              href="/leaves/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Request Leave
            </Link>
          ) : undefined
        }
      />

      {/* Leave Balance Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {balances.map(balance => (
            <div key={balance.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Leave Balance
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {balance.remaining ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {balance.used ?? 0} used · {balance.total_allocated} total
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pending Approvals Alert */}
      {canApprove && pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-amber-600" />
            <p className="font-semibold text-amber-900">
              {pendingApprovals.length} Pending Approval{pendingApprovals.length !== 1 ? 's' : ''}
            </p>
          </div>
          <p className="text-sm text-amber-700">
            You have leave requests waiting for your approval.{' '}
            <Link href="/calendar" className="underline font-medium">
              View Calendar
            </Link>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Requests" value={stats.total} icon={Calendar} color="blue" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} color="green" />
        <StatCard label="Rejected" value={stats.rejected} icon={XCircle} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => {
              if (f !== filter) {
                log('DEBUG', `Filter changed to "${f}"`)
                setFilter(f)
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Leave List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900">No leave requests found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'all'
              ? 'Get started by requesting your first leave'
              : `No ${filter} leaves`}
          </p>
          {filter === 'all' && (
            <Link
              href="/leaves/new"
              className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-blue-600 hover:underline"
            >
              <Plus className="w-4 h-4" />
              Request Leave
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(leave => (
            <LeaveCard key={leave.id} leave={leave} showEmployee={false} showApprover />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string
  value: number
  icon: any
  color: string
}) {
  const colors = {
    blue: 'bg-blue-50   text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50  text-green-600',
    red: 'bg-red-50    text-red-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <Icon className={`w-5 h-5 ${colors[color as keyof typeof colors]}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}