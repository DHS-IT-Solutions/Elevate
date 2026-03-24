// app/(dashboard)/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Calendar, Clock, Users, TrendingUp, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import Link from 'next/link'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [DashboardPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [DashboardPage] ${message}`)
}

interface DashboardData {
  employee: any
  leaveBalance: any[]
  upcomingLeaves: any[]
  pendingApprovals: any[]
  outToday: any[]
  recentTimesheets: any[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // ✅ RBAC Permissions
  const { hasPermission: canApproveLeaves } = usePermission(PERMISSIONS.LEAVES.APPROVE_TEAM)
  const { hasPermission: canViewTeamTimesheets } = usePermission(PERMISSIONS.TIMESHEETS.VIEW_TEAM)

  useEffect(() => {
    log('DEBUG', 'DashboardPage mounted — fetching dashboard data')
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // ── Step 1: auth ────────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        log('WARN', 'No authenticated user', { error: authError?.message })
        setLoading(false)
        return
      }

      log('DEBUG', 'Auth user resolved', { userId: user.id, email: user.email })

      // ── Step 2: resolve employee ────────────────────────────────────────────
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (empError || !emp) {
        log('ERROR', 'Failed to fetch employee record', { 
          userId: user.id, 
          error: empError?.message 
        })
        setLoading(false)
        return
      }

      log('INFO', 'Employee resolved', {
        employeeId: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        position: emp.position ?? 'none',
      })

      const today = new Date().toISOString().split('T')[0]
      const currentYear = new Date().getFullYear()

      // ── Step 3: leave balance ───────────────────────────────────────────────
      log('DEBUG', 'Fetching leave balance', { employeeId: emp.id, year: currentYear })

      const { data: balance, error: balanceError } = await supabase
        .from('employee_leave_balance')
        .select(`
          *,
            leave_policy:leave_policies(id, name, annual_quota)
        `)
        .eq('employee_id', emp.id)
        .eq('year', currentYear)

      if (balanceError) {
        log('ERROR', 'Failed to fetch leave balance', {
          error: balanceError.message
        })
      } else if (!balance?.length) {
        log('INFO', 'No leave balance found - employee may be new or balances not initialized', {
          employeeId: emp.id,
          year: currentYear,
        })
      } else {
        log('INFO', `Loaded ${balance.length} leave balance record(s)`)
      }

      // ── Step 4: upcoming leaves ─────────────────────────────────────────────
      const { data: upcoming } = await supabase
        .from('leaves')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('start_date', today)
        .eq('status', 'approved')
        .order('start_date', { ascending: true })
        .limit(5)

      log('INFO', `Loaded ${upcoming?.length ?? 0} upcoming leave(s)`)

      // ── Step 5: pending approvals (only if user can approve) ────────────────
      let pending: any[] = []
      
      if (canApproveLeaves) {
        const { data: pendingData } = await supabase
          .from('leaves')
          .select(`
            *,
            employee:employees!leaves_employee_id_fkey(
              first_name, last_name, profile_picture_url
            )
        `)
          .or(`approver_id.eq.${emp.id},and(approver_id.is.null,status.eq.pending)`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10)

        pending = pendingData ?? []
        log('INFO', `Loaded ${pending.length} pending approval(s)`)
      }

      // ── Step 6: out of office today ─────────────────────────────────────────
      const { data: outToday } = await supabase
        .from('leaves')
        .select(`
          *,
          employee:employees!leaves_employee_id_fkey(
            first_name, last_name, profile_picture_url
          )
        `)
        .lte('start_date', today)
        .gte('end_date', today)
        .eq('status', 'approved')
        .limit(10)

      log('INFO', `${outToday?.length ?? 0} employee(s) out of office today`)

      // ── Step 7: recent timesheets ───────────────────────────────────────────
      const { data: timesheets } = await supabase
        .from('timesheets')
        .select('*')
        .eq('employee_id', emp.id)
        .order('date', { ascending: false })
        .limit(5)

      log('INFO', `Loaded ${timesheets?.length ?? 0} recent timesheet(s)`)

      // ── Step 8: set state ───────────────────────────────────────────────────
      const dashboardData: DashboardData = {
        employee: emp,
        leaveBalance: balance ?? [],
        upcomingLeaves: upcoming ?? [],
        pendingApprovals: pending,
        outToday: outToday ?? [],
        recentTimesheets: timesheets ?? [],
      }

      setData(dashboardData)

    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchDashboardData()', {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">Unable to load dashboard data</p>
      </div>
    )
  }

  const { employee, leaveBalance, upcomingLeaves, pendingApprovals, outToday, recentTimesheets } = data

  // Calculate leave stats
  const totalAnnualLeave = leaveBalance.find(b => 
    b.leave_policy?.name?.toLowerCase().includes('annual')
  )
  const totalSickLeave = leaveBalance.find(b => 
    b.leave_policy?.name?.toLowerCase().includes('sick')
  )

  const thisWeekTimesheets = recentTimesheets.filter(ts => {
    const tsDate = new Date(ts.date)
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    return tsDate >= weekStart
  })

  const thisWeekHours = thisWeekTimesheets.reduce((sum, ts) => sum + (ts.total_hours || 0), 0)

  return (
    <div>
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 mb-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              Good {getGreeting()}, {employee.first_name}! 👋
            </h1>
            <p className="text-blue-100 mt-1">
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Annual Leave */}
        <StatCard
          icon={Calendar}
          label="Annual Leave"
          value={totalAnnualLeave?.remaining ?? 0}
          subtext={totalAnnualLeave 
            ? `${totalAnnualLeave.used ?? 0} of ${totalAnnualLeave.total_allocated ?? 0} used`
            : 'Not initialized'
          }
          color="green"
        />

        {/* Sick Leave */}
        <StatCard
          icon={AlertCircle}
          label="Sick Days"
          value={totalSickLeave?.remaining ?? 0}
          subtext={totalSickLeave
            ? `${totalSickLeave.used ?? 0} of ${totalSickLeave.total_allocated ?? 0} used`
            : 'Not initialized'
          }
          color="orange"
        />

        {/* This Week Hours */}
        <StatCard
          icon={Clock}
          label="This Week"
          value={`${thisWeekHours.toFixed(1)}h`}
          subtext={`of 40h worked`}
          color="blue"
        />

        {/* Pending Tasks */}
        <StatCard
          icon={CheckCircle2}
          label={canApproveLeaves ? 'Pending Approvals' : 'My Requests'}
          value={canApproveLeaves ? pendingApprovals.length : upcomingLeaves.length}
          subtext={canApproveLeaves 
            ? (pendingApprovals.length > 0 ? 'Needs attention' : 'All caught up!')
            : 'Upcoming leaves'
          }
          color={pendingApprovals.length > 0 ? 'red' : 'blue'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Time Off */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Upcoming Time Off
            </h2>
            <Link href="/leaves" className="text-sm text-blue-600 hover:underline">
              View all →
            </Link>
          </div>

          {upcomingLeaves.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>You have no upcoming time off</p>
              <Link
                href="/leaves"
                className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                Request Leave
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingLeaves.map(leave => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {leave.leave_type?.replace('_', ' ') || 'Leave'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(leave.start_date).toLocaleDateString()} –{' '}
                      {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{leave.total_days} days</span>
                    <p className="text-xs text-green-600 mt-1">Approved</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals (if manager) */}
        {canApproveLeaves && pendingApprovals.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Pending Approvals ({pendingApprovals.length})
              </h2>
              <Link href="/leaves" className="text-sm text-amber-700 hover:underline font-medium">
                View all →
              </Link>
            </div>

            <div className="space-y-3">
              {pendingApprovals.slice(0, 3).map((leave: any) => (
                <div
                  key={leave.id}
                  className="p-3 bg-white border border-amber-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {leave.employee?.profile_picture_url ? (
                      <img
                        src={leave.employee.profile_picture_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700">
                        {leave.employee?.first_name?.charAt(0)}
                        {leave.employee?.last_name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {leave.employee?.first_name} {leave.employee?.last_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {leave.leave_type?.replace('_', ' ')} • {leave.total_days} day
                        {leave.total_days > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(leave.start_date).toLocaleDateString()} –{' '}
                        {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                      Pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Timesheets */}
        {!canApproveLeaves && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Recent Timesheets
              </h2>
              <Link href="/timesheets" className="text-sm text-blue-600 hover:underline">
                View all →
              </Link>
            </div>

            {recentTimesheets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No timesheets yet</p>
                <Link
                  href="/timesheets"
                  className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  Log Hours
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTimesheets.slice(0, 5).map(ts => (
                  <div
                    key={ts.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        ts.status === 'approved' ? 'bg-green-500' :
                        ts.status === 'submitted' ? 'bg-blue-500' :
                        'bg-gray-300'
                      }`} />
                      <span className="text-sm">
                        {new Date(ts.date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ts.total_hours}h</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        ts.status === 'approved' ? 'bg-green-100 text-green-700' :
                        ts.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {ts.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Out of Office Today */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            Out of Office Today
          </h2>

          {outToday.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              Everybody is in the office today! 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {outToday.map((leave: any) => (
                <div key={leave.id} className="flex items-center gap-3 p-2">
                  {leave.employee?.profile_picture_url ? (
                    <img
                      src={leave.employee.profile_picture_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                      {leave.employee?.first_name?.charAt(0)}
                      {leave.employee?.last_name?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {leave.employee?.first_name} {leave.employee?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {leave.leave_type?.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/leaves"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 text-blue-600 font-medium transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Request Leave
            </Link>
            <Link
              href="/timesheets"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 text-green-600 font-medium transition-colors"
            >
              <Clock className="w-5 h-5" />
              Log Timesheet
            </Link>
            <Link
              href="/employees"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 text-purple-600 font-medium transition-colors"
            >
              <Users className="w-5 h-5" />
              Employee Directory
            </Link>
            <Link
              href="/announcements"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 text-orange-600 font-medium transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              Announcements
            </Link>
          </div>
        </div>
      </div>

      {/* Missing Leave Balance Notice */}
      {leaveBalance.length === 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Leave Balances Not Initialized</p>
              <p className="text-sm text-yellow-700 mt-1">
                Your leave balances haven't been set up yet. Please contact HR to initialize your
                leave allowances.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, subtext, color }: any) {
  const colors = {
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <Icon className={`w-5 h-5 ${colors[color as keyof typeof colors]}`} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtext}</p>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}