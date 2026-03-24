// app/(dashboard)/timesheets/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import Avatar from '@/components/shared/Avatar'
import {
  MessageSquare, ChevronDown, ChevronUp, Trash2, Clock, User, Users,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, AlertCircle, FileDown, ClipboardCheck
} from 'lucide-react'

// ── Logger ─────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [TimesheetsPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [TimesheetsPage] ${message}`)
}

interface Comment {
  id: string
  comment_text: string
  employee_id: string
  employee_name: string
  created_at: string
  deleted_at: string | null
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function TimesheetsPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmp, setSelectedEmp] = useState<string>('')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()))
  const [weekData, setWeekData] = useState<any[]>([])
  const [isActualApprover, setIsActualApprover] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [currentEmp, setCurrentEmp] = useState<any>(null)
  const [empDetails, setEmpDetails] = useState<any>(null)
  const [weekStatus, setWeekStatus] = useState<string>('draft')
  const supabase = createClient()
  const { hasPermission: canViewAll, loading: rbacLoading } = usePermission(PERMISSIONS.TIMESHEETS.VIEW_ALL)
  const { hasPermission: canViewTeam } = usePermission(PERMISSIONS.TIMESHEETS.VIEW_TEAM)
  const { hasPermission: canApproveTeam } = usePermission(PERMISSIONS.TIMESHEETS.APPROVE_TEAM)
  const { hasPermission: canExport } = usePermission(PERMISSIONS.TIMESHEETS.EXPORT)
  const { hasPermission: canDeleteComments } = usePermission(PERMISSIONS.TIMESHEETS.DELETE_COMMENTS)

  useEffect(() => {
    if (!rbacLoading) init()
  }, [rbacLoading])
  useEffect(() => {
    if (selectedEmp && currentWeekStart) {
      fetchWeek()
      fetchEmployeeDetails()
    }
  }, [selectedEmp, currentWeekStart])

  // ── Date utilities ───────────────────────────────────────────────────────

  function getStartOfWeek(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function getWeekNumber(d: Date): number {
    const dd = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = dd.getUTCDay() || 7
    dd.setUTCDate(dd.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(dd.getUTCFullYear(), 0, 1))
    return Math.ceil((((dd.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  function formatDate(d: Date, format: 'short' | 'long' = 'short'): string {
    if (format === 'long') {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Format Date to YYYY-MM-DD using local time (NOT toISOString which shifts to UTC)
  function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function canEditWeek(weekStart: Date): boolean {
    const thisWeekStart = getStartOfWeek(new Date())
    return weekStart <= thisWeekStart
  }

  function isApproved(): boolean { return weekStatus === 'approved' }

  // ── Init ─────────────────────────────────────────────────────────────────

  const init = async () => {
    log('DEBUG', 'Initialising timesheets page')
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        log('WARN', 'No authenticated user')
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select(`
          *,
          employee_roles!employee_roles_employee_id_fkey(role_id, roles(name)),
          team:teams(name)
        `)
        .eq('user_id', user.id)
        .single()

      if (empError || !emp) {
        log('ERROR', 'Employee fetch failed', { code: empError?.code, message: empError?.message })
        setError('Employee record not found')
        setLoading(false)
        return
      }

      // Fetch manager separately (Supabase self-join cache limitation)
      let empManager = null
      if (emp.manager_id) {
        const { data: mgr } = await supabase
          .from('employees')
          .select('id, first_name, last_name, email')
          .eq('id', emp.manager_id)
          .single()
        empManager = mgr
        log('DEBUG', 'Manager resolved', { managerId: emp.manager_id, name: mgr ? `${mgr.first_name} ${mgr.last_name}` : 'not found' })
      } else {
        log('WARN', 'No manager_id on current employee', { employeeId: emp.id })
      }

      const empWithManager = { ...emp, manager: empManager }

      log('INFO', 'Current employee resolved', {
        employeeId: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        managerId: emp.manager_id ?? 'none',
      })

      setCurrentEmp(empWithManager)
      setSelectedEmp(emp.id)

      log('DEBUG', 'Role check complete', { canViewAll, canViewTeam })

      // Check if this employee is actually assigned as approver (has direct reports)
      if (emp.id) {
        const { data: directReports } = await supabase
          .from('employees')
          .select('id')
          .eq('manager_id', emp.id)
          .eq('is_active', true)
          .limit(1)
        const hasDirectReports = (directReports?.length ?? 0) > 0
        setIsActualApprover(hasDirectReports)
        log('DEBUG', 'Approver check', { isActualApprover: hasDirectReports })

        // Fetch live pending count for badge
        if (hasDirectReports) {
          const reportIds = (directReports ?? []).map((r: any) => r.id)
          // Get all direct report IDs (not just limited to 1)
          const { data: allReports } = await supabase
            .from('employees')
            .select('id')
            .eq('manager_id', emp.id)
            .eq('is_active', true)
          const allReportIds = (allReports ?? []).map((r: any) => r.id)
          if (allReportIds.length > 0) {
            const { count } = await supabase
              .from('timesheets')
              .select('id', { count: 'exact', head: true })
              .in('employee_id', allReportIds)
              .eq('status', 'submitted')
            setPendingCount(count ?? 0)
          }
        }
      }

      // Fetch employee list for managers
      if ((canViewAll || canViewTeam) && emp.company_id) {
        const { data: team, error: teamError } = await supabase
          .from('employees')
          .select(`
            id, first_name, last_name, profile_picture_url, position, region, manager_id,
            team:teams(name)
          `)
          .eq('company_id', emp.company_id)
          .eq('is_active', true)
          .order('first_name')

        if (teamError) {
          log('WARN', 'Failed to fetch team list', { message: teamError.message })
          setEmployees([emp])
        } else {
          log('INFO', `Loaded ${team?.length ?? 0} employees for manager view`)
          setEmployees(team ?? [emp])
        }
      } else {
        setEmployees([emp])
      }

      setLoading(false)
    } catch (err: any) {
      log('ERROR', 'Unexpected error in init()', { error: err.message })
      setError(err.message)
      setLoading(false)
    }
  }

  // ── Fetch employee details (for the selected employee) ───────────────────

  const fetchEmployeeDetails = async () => {
    log('DEBUG', 'Fetching employee details', { employeeId: selectedEmp })
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        team:teams(name),
        employee_roles!employee_roles_employee_id_fkey(role_id, roles(name))
      `)
      .eq('id', selectedEmp)
      .single()

    if (error || !data) {
      log('WARN', 'fetchEmployeeDetails failed', { code: error?.code, message: error?.message })
      return
    }

    // Fetch manager separately (Supabase self-join cache limitation)
    let manager = null
    if (data.manager_id) {
      const { data: mgr } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email')
        .eq('id', data.manager_id)
        .single()
      manager = mgr
    }

    log('DEBUG', 'Employee details loaded', {
      employeeId: data.id,
      managerId: data.manager_id ?? 'none',
      manager: manager ? `${(manager as any).first_name} ${(manager as any).last_name}` : 'none',
    })
    setEmpDetails({ ...data, manager })
  }

  // ── Fetch week data ──────────────────────────────────────────────────────

  const fetchWeek = async () => {
    log('DEBUG', 'Fetching week data', {
      employeeId: selectedEmp,
      weekStart: toDateStr(currentWeekStart),
    })

    const days = []
    let computedStatus = 'draft'

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      const dateStr = toDateStr(date)

      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .eq('employee_id', selectedEmp)
        .eq('date', dateStr)
        .maybeSingle()

      if (error) {
        log('WARN', 'Error fetching day', { date: dateStr, message: error.message })
      }

      if (data?.status === 'submitted') computedStatus = 'submitted'
      if (data?.status === 'approved') computedStatus = 'approved'

      days.push({
        id: data?.id ?? null,
        date: dateStr,
        dayName: date.toLocaleDateString('en-GB', { weekday: 'long' }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        start: data?.clock_in?.split('T')[1]?.slice(0, 5) ?? null,
        finish: data?.clock_out?.split('T')[1]?.slice(0, 5) ?? null,
        break: data?.break_time_minutes ?? 60,
        hours: data?.total_hours ?? 0,
        hasComments: data?.has_comments ?? false,
        status: data?.status ?? 'draft',
        withdrawn: !!data?.withdrawn_at,
        rejectionReason: data?.rejection_reason ?? null,
        rejectedAt: data?.rejected_at ?? null,
      })
    }

    setWeekData(days)
    setWeekStatus(computedStatus)
    log('INFO', 'Week loaded', {
      weekStart: toDateStr(currentWeekStart),
      weekStatus: computedStatus,
      daysWithHours: days.filter(d => d.hours > 0).length,
    })
  }

  // ── Save day ─────────────────────────────────────────────────────────────

  const saveDay = async (day: any, updates: any) => {
    const { start, finish, break: breakMins } = updates
    let hours = 0

    if (start && finish) {
      const [sh, sm] = start.split(':').map(Number)
      const [fh, fm] = finish.split(':').map(Number)
      hours = Math.round((((fh * 60 + fm) - (sh * 60 + sm) - breakMins) / 60) * 100) / 100
    }

    log('DEBUG', 'Saving day', { date: day.date, start, finish, breakMins, computedHours: hours })

    try {
      const { data: existing } = await supabase
        .from('timesheets')
        .select('id')
        .eq('employee_id', selectedEmp)
        .eq('date', day.date)
        .maybeSingle()

      let result

      if (existing) {
        const { data, error } = await supabase
          .from('timesheets')
          .update({
            clock_in: start ? `${day.date}T${start}:00` : null,
            clock_out: finish ? `${day.date}T${finish}:00` : null,
            break_time_minutes: breakMins,
            total_hours: hours,
            status: 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) { log('ERROR', 'Update failed', { message: error.message }); throw error }
        log('INFO', 'Timesheet updated', { timesheetId: data.id, hours })
        result = data
      } else {
        const { data, error } = await supabase
          .from('timesheets')
          .insert({
            employee_id: selectedEmp,
            date: day.date,
            clock_in: start ? `${day.date}T${start}:00` : null,
            clock_out: finish ? `${day.date}T${finish}:00` : null,
            break_time_minutes: breakMins,
            total_hours: hours,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) { log('ERROR', 'Insert failed', { message: error.message }); throw error }
        log('INFO', 'Timesheet created', { timesheetId: data.id, date: day.date, hours })
        result = data
      }

      await fetchWeek()
      return result
    } catch (err: any) {
      log('ERROR', 'saveDay exception', { error: err.message })
      alert(`Failed to save timesheet: ${err.message}`)
      return null
    }
  }

  // ── Submit for approval ──────────────────────────────────────────────────

  const handleSubmit = async () => {
    setActionError(null)
    const workingDays = weekData.filter(d => !d.isWeekend && d.hours > 0 && d.id)

    if (workingDays.length === 0) {
      setActionError('Please add hours for at least one working day before submitting.')
      return
    }

    // Determine approver — use empDetails.manager (the selected employee's manager)
    const manager = empDetails?.manager
    if (!manager) {
      setActionError('No approver assigned to this employee. Please contact HR.')
      log('WARN', 'Submit blocked — no manager assigned', { employeeId: selectedEmp })
      return
    }

    log('INFO', 'Submitting week for approval', {
      employeeId: selectedEmp,
      approverId: manager.id,
      approverEmail: manager.email,
      days: workingDays.map((d: any) => d.date),
    })

    setActionLoading(true)
    try {
      const now = new Date().toISOString()

      for (const day of workingDays) {
        const { error } = await supabase
          .from('timesheets')
          .update({
            status: 'submitted',
            submitted_at: now,
            submitted_by: currentEmp.id,
            updated_at: now,
          })
          .eq('id', day.id)

        if (error) {
          log('ERROR', 'Failed to submit day', { date: day.date, message: error.message })
          throw error
        }
      }

      log('INFO', 'Week submitted successfully', {
        days: workingDays.length,
        approver: `${manager.first_name} ${manager.last_name}`,
      })

      await fetchWeek()
    } catch (err: any) {
      log('ERROR', 'handleSubmit exception', { error: err.message })
      setActionError(`Submission failed: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Withdraw ─────────────────────────────────────────────────────────────

  const handleWithdraw = async () => {
    setActionError(null)
    const submittedDays = weekData.filter(d => !d.isWeekend && d.id && d.status === 'submitted')

    if (submittedDays.length === 0) {
      setActionError('No submitted days to withdraw.')
      return
    }

    log('INFO', 'Withdrawing week submission', {
      employeeId: selectedEmp,
      days: submittedDays.map((d: any) => d.date),
    })

    setActionLoading(true)
    try {
      const now = new Date().toISOString()

      for (const day of submittedDays) {
        const { error } = await supabase
          .from('timesheets')
          .update({
            status: 'draft',
            withdrawn_at: now,
            withdrawn_by: currentEmp.id,
            submitted_at: null,
            submitted_by: null,
            updated_at: now,
          })
          .eq('id', day.id)

        if (error) {
          log('ERROR', 'Failed to withdraw day', { date: day.date, message: error.message })
          throw error
        }
      }

      log('INFO', 'Week withdrawn successfully', { days: submittedDays.length })
      await fetchWeek()
    } catch (err: any) {
      log('ERROR', 'handleWithdraw exception', { error: err.message })
      setActionError(`Withdrawal failed: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Week navigation ──────────────────────────────────────────────────────

  const goToPreviousWeek = () => {
    const w = new Date(currentWeekStart)
    w.setDate(w.getDate() - 7)
    setCurrentWeekStart(w)
  }

  const goToNextWeek = () => {
    const w = new Date(currentWeekStart)
    w.setDate(w.getDate() + 7)
    if (w > getStartOfWeek(new Date())) {
      alert('Cannot view future weeks')
      return
    }
    setCurrentWeekStart(w)
  }

  const goToCurrentWeek = () => setCurrentWeekStart(getStartOfWeek(new Date()))

  // ── Derived state ────────────────────────────────────────────────────────

  const emp = employees.find(e => e.id === selectedEmp)
  const total = weekData.reduce((s, d) => s + d.hours, 0)
  const weekEnd = new Date(currentWeekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const canEdit = canEditWeek(currentWeekStart) && !isApproved() && weekStatus !== 'submitted'

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p>Loading timesheets...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-xl max-w-md mx-auto">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }


  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="View and submit timesheets. Select a day to view details and add comments."
      />

      {/* Top action bar */}
      <div className="flex items-center justify-end gap-3 mb-6">
        {canApproveTeam && isActualApprover && (
          <button
            onClick={() => router.push('/timesheets/approvals')}
            className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium border border-yellow-400 
                       text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" />
            Pending Approvals
            {pendingCount > 0 && (
              <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs 
                               font-bold flex items-center justify-center leading-none">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        )}
        {canExport && (
          <button
            onClick={() => router.push(`/timesheets/export?employeeId=${selectedEmp}`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 
               text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* Employee details banner */}
      {empDetails && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-500 text-xs">Team</p>
                <p className="font-medium">{empDetails.team?.name || 'No team'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-500 text-xs">Approver</p>
                <p className="font-medium">
                  {empDetails.manager
                    ? `${(empDetails.manager as any).first_name} ${(empDetails.manager as any).last_name}`
                    : <span className="text-red-500">Not assigned</span>
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-500 text-xs">Week Status</p>
                <p className={`font-medium capitalize ${weekStatus === 'approved' ? 'text-green-600' :
                  weekStatus === 'submitted' ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                  {weekStatus === 'submitted' ? 'Pending Approval' : weekStatus}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-500 text-xs">Total This Week</p>
                <p className="font-medium">{total.toFixed(2)}h / 40h</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Week selector & employee picker */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Week Period</label>
            <div className="flex items-center gap-2">
              <button onClick={goToPreviousWeek} className="p-2 border rounded-lg hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <p className="text-sm font-medium">
                  Week {getWeekNumber(currentWeekStart)} — {currentWeekStart.getFullYear()}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(currentWeekStart)} – {formatDate(weekEnd)}
                </p>
              </div>
              <button
                onClick={goToNextWeek}
                disabled={currentWeekStart >= getStartOfWeek(new Date())}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={goToCurrentWeek}
                className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Today
              </button>
            </div>
          </div>

          {(canViewAll || canViewTeam) && (
            <div>
              <label className="block text-sm font-medium mb-2">Employee</label>
              <select
                value={selectedEmp}
                onChange={e => setSelectedEmp(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} — {e.team?.name || 'No team'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Approved banner */}
      {isApproved() && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-green-900">Timesheet Approved</p>
            <p className="text-sm text-green-700 mt-1">
              {empDetails?.manager
                ? `Approved by ${(empDetails.manager as any).first_name} ${(empDetails.manager as any).last_name}.`
                : 'This timesheet has been approved.'
              }
              {' '}This week&apos;s timesheet is now locked and cannot be modified.
            </p>
          </div>
        </div>
      )}

      {weekStatus === 'submitted' && !canApproveTeam && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Pending Approval</p>
            <p className="text-sm text-blue-700 mt-1">
              Your timesheet has been submitted to{' '}
              <span className="font-medium">
                {empDetails?.manager
                  ? `${(empDetails.manager as any).first_name} ${(empDetails.manager as any).last_name}`
                  : 'your manager'
                }
              </span>
              {' '}for review. You can withdraw and edit if needed.
            </p>
          </div>
        </div>
      )}

      {/* Rejection banner */}
      {weekStatus === 'draft' && weekData.some(d => d.rejectionReason) && (() => {
        const rejectedDay = weekData.find(d => d.rejectionReason)
        return (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-900">Timesheet Returned for Revision</p>
              <p className="text-sm text-red-700 mt-1">
                Your timesheet was returned by your approver. Please review the feedback below, make the necessary changes, and resubmit.
              </p>
              <div className="mt-3 bg-white border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">Rejection Reason</p>
                <p className="text-sm text-gray-800">{rejectedDay?.rejectionReason}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Timesheet table */}
      {emp && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={`${emp.first_name} ${emp.last_name}`} imageUrl={emp.profile_picture_url} size="md" />
              <div>
                <h3 className="font-semibold">{emp.first_name} {emp.last_name}</h3>
                <p className="text-sm text-gray-500">
                  Total: {total.toFixed(2)}h / 40.00h • {emp.team?.name || 'No team'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Employee: Submit */}
              {weekStatus === 'draft' && canEdit && selectedEmp === currentEmp?.id && (
                <button
                  onClick={handleSubmit}
                  disabled={actionLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 
                             disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {actionLoading ? 'Submitting…' : 'Submit for Approval'}
                </button>
              )}

              {/* Employee: Withdraw */}
              {weekStatus === 'submitted' && selectedEmp === currentEmp?.id && (
                <button
                  onClick={handleWithdraw}
                  disabled={actionLoading}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 
                             disabled:opacity-50 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {actionLoading ? 'Withdrawing…' : 'Withdraw'}
                </button>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3">Day</th>
                <th className="text-left px-6 py-3">Start</th>
                <th className="text-left px-6 py-3">Finish</th>
                <th className="text-left px-6 py-3">Break</th>
                <th className="text-left px-6 py-3">Total hours</th>
                <th className="text-left px-6 py-3">Contract</th>
                <th className="text-left px-6 py-3">Difference</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {weekData.map(day => {
                const contract = day.isWeekend ? 0 : 8
                const diff = day.hours - contract
                const canClickDay = !day.isWeekend && (canEdit || day.hasComments || canApproveTeam)


                return (
                  <tr
                    key={day.date}
                    onClick={() => canClickDay && (setSelectedDay(day), setShowModal(true))}
                    className={`
                      ${day.isWeekend ? 'bg-gray-50' : ''}
                      ${canClickDay ? 'cursor-pointer hover:bg-blue-50' : ''}
                    `}
                  >
                    <td className="px-6 py-3">
                      <div className="font-medium text-blue-600">{day.dayName}</div>
                      <div className="text-xs text-gray-500">{formatDate(new Date(day.date))}</div>
                    </td>
                    <td className="px-6 py-3">{day.start || '—'}</td>
                    <td className="px-6 py-3">{day.finish || '—'}</td>
                    <td className="px-6 py-3">
                      {day.break
                        ? `${Math.floor(day.break / 60)}:${(day.break % 60).toString().padStart(2, '0')}`
                        : '—'}
                    </td>
                    <td className="px-6 py-3 font-medium text-blue-600">
                      {day.hours > 0 ? `${day.hours.toFixed(2)}h` : '00:00h'}
                    </td>
                    <td className="px-6 py-3">{contract.toFixed(2)}h</td>
                    <td className="px-6 py-3">
                      {diff !== 0 ? (
                        <span className={diff > 0 ? 'text-green-600' : 'text-red-600'}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}h
                        </span>
                      ) : '00:00h'}
                    </td>
                    <td className="px-6 py-3">
                      {!day.isWeekend && day.hours > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${day.status === 'approved' ? 'bg-green-100 text-green-700' :
                          day.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                          {day.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {day.hasComments && <MessageSquare className="w-4 h-4 text-blue-600" />}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold border-t-2">
                <td className="px-6 py-3">Total</td>
                <td colSpan={3} className="px-6 py-3"></td>
                <td className="px-6 py-3 text-blue-600">{total.toFixed(2)}h</td>
                <td className="px-6 py-3">40.00h</td>
                <td className="px-6 py-3">
                  {total !== 40 ? (
                    <span className={total > 40 ? 'text-green-600' : 'text-red-600'}>
                      {total > 40 ? '+' : ''}{(total - 40).toFixed(2)}h
                    </span>
                  ) : '00:00h'}
                </td>
                <td colSpan={2} className="px-6 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Day modal */}
      {showModal && selectedDay && emp && (
        <DayModal
          day={selectedDay}
          region={emp.region || 'India'}
          employeeId={selectedEmp}
          currentUserId={currentEmp.id}
          canEdit={canEdit}
          isManager={canApproveTeam}
          onClose={() => { setShowModal(false); fetchWeek() }}
          onSave={saveDay}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DAY MODAL
// ══════════════════════════════════════════════════════════════════════════════

function DayModal({ day, region, employeeId, currentUserId, canEdit, isManager, onClose, onSave }: any) {
  const [start, setStart] = useState(day.start || '09:00')
  const [finish, setFinish] = useState(day.finish || '18:00')
  const [breakMins, setBreak] = useState(day.break ?? 60)
  const [newComment, setNewComment] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [showComments, setShowComments] = useState(true)
  const [showChangelog, setShowChangelog] = useState(false)
  const [changeLogs, setChangeLogs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [approverName, setApproverName] = useState('Loading…')
  const supabase = createClient()

  useEffect(() => {
    if (day.id) { fetchComments(); fetchChangelog() }
    fetchApprover()
  }, [day.id])

  const fetchApprover = async () => {
    // Two-step: get manager_id first, then fetch manager row
    const { data: empData } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', employeeId)
      .single()

    if (!empData?.manager_id) {
      setApproverName('No approver assigned')
      return
    }

    const { data: mgr } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', empData.manager_id)
      .single()

    setApproverName(mgr ? `${mgr.first_name} ${mgr.last_name}` : 'No approver assigned')
  }

  const fetchComments = async () => {
    if (!day.id) return

    // Step 1: fetch comments without join (FK not in Supabase schema cache)
    const { data, error } = await supabase
      .from('timesheet_comments')
      .select('*')
      .eq('timesheet_id', day.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) { console.warn('[DayModal] fetchComments error:', error.message); return }
    if (!data || data.length === 0) { setComments([]); return }

    // Step 2: fetch employee names for all unique commenter IDs
    const employeeIds = [...new Set(data.map((c: any) => c.employee_id).filter(Boolean))]
    const { data: employees } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .in('id', employeeIds)

    const nameMap: Record<string, string> = {}
      ; (employees ?? []).forEach((e: any) => {
        nameMap[e.id] = `${e.first_name} ${e.last_name}`
      })

    setComments(data.map((c: any) => ({
      ...c,
      employee_name: nameMap[c.employee_id] ?? 'Unknown',
    })))
  }

  const fetchChangelog = async () => {
    if (!day.id) return
    const { data } = await supabase
      .from('timesheet_change_log')
      .select('*, employee:employees!timesheet_change_log_changed_by_fkey(first_name, last_name)')
      .eq('timesheet_id', day.id)
      .order('created_at', { ascending: false })

    setChangeLogs((data ?? []).map((c: any) => ({
      ...c,
      changed_by_name: c.employee
        ? `${c.employee.first_name} ${c.employee.last_name}`
        : 'System',
    })))
  }

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const savedTimesheet = await onSave(day, { start, finish, break: breakMins })

      if (newComment.trim() && savedTimesheet?.id) {
        const { error: commentError } = await supabase
          .from('timesheet_comments')
          .insert({
            timesheet_id: savedTimesheet.id,
            employee_id: currentUserId,
            comment_text: newComment.trim(),
          })

        if (commentError) {
          console.warn('[DayModal] Comment save error:', commentError.message)
        } else {
          await supabase.from('timesheets').update({ has_comments: true }).eq('id', savedTimesheet.id)
          setNewComment('')
          await fetchComments()
        }
      }

      onClose()
    } catch (err) {
      console.error('[DayModal] handleSave error:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return
    await supabase.from('timesheet_comments').update({
      deleted_at: new Date().toISOString(),
      deleted_by: currentUserId,
    }).eq('id', commentId)
    await fetchComments()
  }

  const calcTotal = () => {
    const [sh, sm] = start.split(':').map(Number)
    const [fh, fm] = finish.split(':').map(Number)
    return Math.max(0, Math.floor(((fh * 60 + fm) - (sh * 60 + sm) - breakMins) / 60))
  }

  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, '0')
    const label = region === 'UK'
      ? `${i % 12 || 12}:00 ${i >= 12 ? 'PM' : 'AM'}`
      : `${h}:00`
    return { value: `${h}:00`, label }
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">
              {day.dayName}, {new Date(day.date).toLocaleDateString('en-GB')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Approver: <span className="font-medium ml-1">{approverName}</span>
            </div>
            {day.status && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Status: <span className={`font-medium capitalize ml-1 ${day.status === 'approved' ? 'text-green-600' :
                  day.status === 'submitted' ? 'text-blue-600' : 'text-gray-600'
                  }`}>{day.status}</span>
              </div>
            )}
          </div>
          {!canEdit && (
            <p className="text-sm text-yellow-600 mt-2">
              This timesheet is locked and cannot be edited.
            </p>
          )}
        </div>

        <div className="p-6">
          {/* Time fields */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Start</label>
              <select value={start} onChange={e => setStart(e.target.value)} disabled={!canEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
                {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Finish</label>
              <select value={finish} onChange={e => setFinish(e.target.value)} disabled={!canEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
                {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Break</label>
              <select value={breakMins} onChange={e => setBreak(Number(e.target.value))} disabled={!canEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
                <option value={0}>0:00</option>
                <option value={30}>0:30</option>
                <option value={60}>1:00</option>
                <option value={90}>1:30</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Total</label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700">
                {calcTotal()}h
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="border rounded-lg mb-4">
            <button onClick={() => setShowComments(!showComments)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Comments ({comments.length})</span>
              </div>
              {showComments ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showComments && (
              <div className="p-4 border-t space-y-4">
                {comments.length === 0 && (
                  <p className="text-sm text-gray-400">No comments yet.</p>
                )}
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{c.employee_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {new Date(c.created_at).toLocaleString('en-GB')}
                          </span>
                          {(c.employee_id === currentUserId || isManager) && (
                            <button onClick={() => deleteComment(c.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{c.comment_text}</p>
                    </div>
                  </div>
                ))}
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  placeholder="Add a comment…"
                />
              </div>
            )}
          </div>

          {/* Change log */}
          <div className="border rounded-lg">
            <button onClick={() => setShowChangelog(!showChangelog)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Change Log ({changeLogs.length})</span>
              </div>
              {showChangelog ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showChangelog && (
              <div className="p-4 border-t space-y-2">
                {changeLogs.length === 0 && (
                  <p className="text-sm text-gray-400">No changes recorded.</p>
                )}
                {changeLogs.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-2 text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{entry.changed_by_name}</span>
                      <span className="text-gray-600"> — {entry.change_type} </span>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleString('en-GB')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white">
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg 
                         hover:bg-green-700 disabled:bg-gray-400">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}