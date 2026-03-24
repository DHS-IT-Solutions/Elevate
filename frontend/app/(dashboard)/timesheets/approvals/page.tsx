// app/(dashboard)/timesheets/approvals/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute, usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import Avatar from '@/components/shared/Avatar'
import {
    CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
    AlertCircle, User, Calendar, Search, ArrowLeft,
    ThumbsUp, MessageSquare, RefreshCw, X
} from 'lucide-react'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', msg: string, data?: unknown) => {
    const ts = new Date().toISOString()
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
    data !== undefined ? fn(`[${ts}] [${level}] [ApprovalsPage] ${msg}`, data)
        : fn(`[${ts}] [${level}] [ApprovalsPage] ${msg}`)
}

interface PendingWeek {
    employeeId: string
    employeeName: string
    position: string | null
    profilePicture: string | null
    teamName: string | null
    weekStart: string
    weekEnd: string
    weekLabel: string
    totalHours: number
    totalDays: number
    submittedAt: string | null
    days: PendingDay[]
}

interface PendingDay {
    id: string
    date: string
    dayName: string
    dateFormatted: string
    clockIn: string | null
    clockOut: string | null
    breakMins: number
    totalHours: number
    status: string
    comments: CommentEntry[]
}

interface CommentEntry {
    id: string
    text: string
    authorName: string
    createdAt: string
}

export default function ApprovalsPage() {
    const router = useRouter()
    const supabase = createClient()
    const { hasPermission: canApproveTimesheets, loading: rbacLoading } = usePermission(PERMISSIONS.TIMESHEETS.APPROVE_TEAM)

    const [currentEmp, setCurrentEmp] = useState<any>(null)
    const [pendingWeeks, setPendingWeeks] = useState<PendingWeek[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [rejectingKey, setRejectingKey] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    useEffect(() => {
        if (!rbacLoading) init()
    }, [rbacLoading])

    // Auto-dismiss success message
    useEffect(() => {
        if (!successMessage) return
        const t = setTimeout(() => setSuccessMessage(null), 5000)
        return () => clearTimeout(t)
    }, [successMessage])

    const init = async () => {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) { setError('Not authenticated'); setLoading(false); return }

            const { data: emp, error: empError } = await supabase
                .from('employees')
                .select('id, first_name, last_name, company_id, profile_picture_url')
                .eq('user_id', user.id)
                .single()

            if (empError || !emp) { setError('Employee record not found'); setLoading(false); return }

            if (!canApproveTimesheets) {
                setError('You do not have permission to approve timesheets.')
                setLoading(false)
                return
            }

            const { data: check } = await supabase
                .from('employees')
                .select('id')
                .eq('manager_id', emp.id)
                .eq('is_active', true)
                .limit(1)

            if (!check || check.length === 0) {
                setError('You are not assigned as an approver for any employee.')
                setLoading(false)
                return
            }

            setCurrentEmp(emp)
            await loadPending(emp.id)
            setLoading(false)
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    const loadPending = async (managerId: string) => {
        // 1. Get direct reports
        const { data: reports, error: rErr } = await supabase
            .from('employees')
            .select('id, first_name, last_name, position, profile_picture_url, team:teams(name)')
            .eq('manager_id', managerId)
            .eq('is_active', true)

        if (rErr || !reports || reports.length === 0) {
            setPendingWeeks([])
            return
        }

        const empMap: Record<string, any> = {}
        reports.forEach((r: any) => { empMap[r.id] = r })
        const reportIds = reports.map((r: any) => r.id)

        // 2. Get submitted timesheets (only days with actual hours logged)
        const { data: sheets, error: sErr } = await supabase
            .from('timesheets')
            .select('id, employee_id, date, clock_in, clock_out, break_time_minutes, total_hours, status, submitted_at')
            .in('employee_id', reportIds)
            .eq('status', 'submitted')
            .gt('total_hours', 0)
            .order('date', { ascending: true })

        if (sErr || !sheets || sheets.length === 0) {
            setPendingWeeks([])
            return
        }

        // 3. Get comments for these timesheets
        const sheetIds = sheets.map((s: any) => s.id)
        const { data: allComments } = await supabase
            .from('timesheet_comments')
            .select('id, timesheet_id, comment_text, employee_id, created_at')
            .in('timesheet_id', sheetIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })

        // Get commenter names
        const commenterIds = [...new Set((allComments ?? []).map((c: any) => c.employee_id))]
        const commenterMap: Record<string, string> = {}
        if (commenterIds.length > 0) {
            const { data: commenters } = await supabase
                .from('employees')
                .select('id, first_name, last_name')
                .in('id', commenterIds)
            ;(commenters ?? []).forEach((c: any) => {
                commenterMap[c.id] = `${c.first_name} ${c.last_name}`
            })
        }

        // Map comments by timesheet_id
        const commentsBySheet: Record<string, CommentEntry[]> = {}
        ;(allComments ?? []).forEach((c: any) => {
            if (!commentsBySheet[c.timesheet_id]) commentsBySheet[c.timesheet_id] = []
            commentsBySheet[c.timesheet_id].push({
                id: c.id,
                text: c.comment_text,
                authorName: commenterMap[c.employee_id] || 'Unknown',
                createdAt: c.created_at,
            })
        })

        // 4. Group by employee + week
        const weekMap: Record<string, PendingWeek> = {}

        for (const sheet of sheets as any[]) {
            const monStr = getMonday(sheet.date)
            const sunStr = getSunday(monStr)
            const key = `${sheet.employee_id}__${monStr}`
            const emp = empMap[sheet.employee_id]
            if (!emp) continue

            if (!weekMap[key]) {
                weekMap[key] = {
                    employeeId: emp.id,
                    employeeName: `${emp.first_name} ${emp.last_name}`,
                    position: emp.position ?? null,
                    profilePicture: emp.profile_picture_url ?? null,
                    teamName: (emp.team as any)?.name ?? null,
                    weekStart: monStr,
                    weekEnd: sunStr,
                    weekLabel: `${fmtDateLong(monStr)} – ${fmtDateLong(sunStr)}`,
                    totalHours: 0,
                    totalDays: 0,
                    submittedAt: sheet.submitted_at ?? null,
                    days: [],
                }
            }

            const hours = Number(sheet.total_hours ?? 0)
            weekMap[key].totalHours += hours
            weekMap[key].totalDays++

            const clockIn = parseTime(sheet.clock_in)
            const clockOut = parseTime(sheet.clock_out)

            // Parse date as local to get correct day name
            const dateObj = parseLocalDate(sheet.date)

            weekMap[key].days.push({
                id: sheet.id,
                date: sheet.date,
                dayName: dateObj.toLocaleDateString('en-GB', { weekday: 'long' }),
                dateFormatted: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                clockIn,
                clockOut,
                breakMins: Number(sheet.break_time_minutes ?? 0),
                totalHours: hours,
                status: sheet.status ?? 'submitted',
                comments: commentsBySheet[sheet.id] ?? [],
            })
        }

        const weeks = Object.values(weekMap)
        weeks.forEach(w => w.days.sort((a, b) => a.date.localeCompare(b.date)))
        weeks.sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))
        setPendingWeeks(weeks)
    }

    const handleRefresh = async () => {
        if (!currentEmp || refreshing) return
        setRefreshing(true)
        await loadPending(currentEmp.id)
        setRefreshing(false)
    }

    const handleApprove = async (week: PendingWeek) => {
        const key = `${week.employeeId}__${week.weekStart}`
        setActionLoading(key)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase
                .from('timesheets')
                .update({ status: 'approved', approved_by: currentEmp.id, approved_at: now, updated_at: now })
                .in('id', week.days.map(d => d.id))
            if (error) throw error
            setPendingWeeks(prev => prev.filter(w => `${w.employeeId}__${w.weekStart}` !== key))
            setSuccessMessage(`Approved timesheet for ${week.employeeName} (${week.weekLabel})`)
        } catch (err: any) {
            alert(`Approval failed: ${err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (week: PendingWeek) => {
        const key = `${week.employeeId}__${week.weekStart}`
        const reason = rejectReason.trim()
        if (!reason) return
        setActionLoading(key)
        try {
            const now = new Date().toISOString()
            const { error } = await supabase
                .from('timesheets')
                .update({
                    status: 'draft', rejection_reason: reason,
                    rejected_at: now, submitted_at: null, submitted_by: null, updated_at: now,
                })
                .in('id', week.days.map(d => d.id))
            if (error) throw error
            setPendingWeeks(prev => prev.filter(w => `${w.employeeId}__${w.weekStart}` !== key))
            setRejectingKey(null)
            setRejectReason('')
            setSuccessMessage(`Rejected timesheet for ${week.employeeName} — returned to draft`)
        } catch (err: any) {
            alert(`Rejection failed: ${err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    // Parse YYYY-MM-DD as local date (no UTC shift)
    function parseLocalDate(dateStr: string): Date {
        const [y, m, d] = dateStr.split('-').map(Number)
        return new Date(y, m - 1, d)
    }

    // Format local date back to YYYY-MM-DD string
    function toDateStr(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    function getMonday(dateStr: string): string {
        const date = parseLocalDate(dateStr)
        const day = date.getDay()
        date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
        return toDateStr(date)
    }

    function getSunday(mondayStr: string): string {
        const date = parseLocalDate(mondayStr)
        date.setDate(date.getDate() + 6)
        return toDateStr(date)
    }

    function parseTime(val: string | null): string | null {
        if (!val) return null
        if (val.includes('T')) {
            return val.split('T')[1]?.slice(0, 5) ?? null
        }
        return val.slice(0, 5)
    }

    function fmtDateLong(s: string): string {
        return parseLocalDate(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    function fmtTime(t: string | null): string { return t ?? '—' }
    function fmtBreak(mins: number): string {
        if (!mins) return '—'
        const h = Math.floor(mins / 60)
        const m = mins % 60
        if (h > 0 && m > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
        if (h > 0) return `${h}h`
        return `${m}m`
    }
    function fmtAgo(iso: string | null): string {
        if (!iso) return ''
        const diff = Date.now() - new Date(iso).getTime()
        const mins = Math.floor(diff / 60000)
        const hrs = Math.floor(mins / 60)
        const days = Math.floor(hrs / 24)
        if (days > 1) return `Submitted ${days} days ago`
        if (days === 1) return 'Submitted yesterday'
        if (hrs > 0) return `Submitted ${hrs}h ago`
        if (mins > 0) return `Submitted ${mins}m ago`
        return 'Submitted just now'
    }
    function fmtCommentTime(iso: string): string {
        return new Date(iso).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
        })
    }

    const toggleExpand = (key: string) => setExpandedWeeks(prev => {
        const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s
    })

    const filtered = pendingWeeks.filter(w =>
        !searchQuery || w.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // ── Loading / Error states ────────────────────────────────────────────────

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
            <p className="text-gray-500 text-sm">Loading approvals...</p>
        </div>
    )

    if (error) return (
        <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="font-semibold text-red-800">Access Restricted</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button onClick={() => router.back()}
                    className="mt-4 flex items-center gap-2 mx-auto text-sm text-gray-600 hover:text-gray-800">
                    <ArrowLeft className="w-4 h-4" /> Go back
                </button>
            </div>
        </div>
    )

    // ── Main render ─────────────────────────────────────────────────────────────

    return (
        <ProtectedRoute permission={PERMISSIONS.TIMESHEETS.APPROVE_TEAM}>
            <div>
                <PageHeader
                    title="Timesheet Approvals"
                    subtitle="Review and action submitted timesheets from your direct reports."
                />

                {/* Success toast */}
                {successMessage && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3 animate-in fade-in">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <p className="text-sm font-medium text-green-800 flex-1">{successMessage}</p>
                        <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 leading-none">{pendingWeeks.length}</p>
                            <p className="text-sm text-gray-500 mt-1">Pending week{pendingWeeks.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 leading-none">
                                {new Set(pendingWeeks.map(w => w.employeeId)).size}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Employee{new Set(pendingWeeks.map(w => w.employeeId)).size !== 1 ? 's' : ''} awaiting</p>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 leading-none">
                                {pendingWeeks.reduce((s, w) => s + w.totalHours, 0).toFixed(1)}h
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Total hours pending</p>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search by employee name..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 text-sm outline-none placeholder:text-gray-400"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    )}
                    <div className="h-5 w-px bg-gray-200 mx-1" />
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Empty state */}
                {filtered.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ThumbsUp className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-800">All caught up!</p>
                        <p className="text-sm text-gray-500 mt-1">
                            {searchQuery ? 'No results match your search.' : 'No timesheets are pending your approval.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(week => {
                            const key = `${week.employeeId}__${week.weekStart}`
                            const isExpanded = expandedWeeks.has(key)
                            const isActioning = actionLoading === key
                            const isRejecting = rejectingKey === key
                            const hasComments = week.days.some(d => d.comments.length > 0)

                            return (
                                <div key={key}
                                    className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all ${isActioning ? 'opacity-60 pointer-events-none' : 'hover:shadow-md'}`}
                                >
                                    {/* Week summary row */}
                                    <div className="px-6 py-5 flex items-center gap-5">
                                        <Avatar name={week.employeeName} imageUrl={week.profilePicture} size="lg" />

                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-semibold text-gray-900">{week.employeeName}</p>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {week.position || 'No position'} {week.teamName ? `\u2022 ${week.teamName}` : ''}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                                    <Clock className="w-3 h-3" />
                                                    {fmtAgo(week.submittedAt)}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {week.weekLabel}
                                                </span>
                                                {hasComments && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                                                        <MessageSquare className="w-3 h-3" /> Has comments
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Hours summary */}
                                        <div className="text-right mr-4 hidden sm:block">
                                            <p className="text-xl font-bold text-gray-900">{week.totalHours.toFixed(1)}h</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {week.totalDays} day{week.totalDays !== 1 ? 's' : ''} logged
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button onClick={() => toggleExpand(key)}
                                                className="p-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                                                title={isExpanded ? 'Collapse' : 'View details'}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>

                                            {!isRejecting && (
                                                <button
                                                    onClick={() => { setRejectingKey(key); setRejectReason('') }}
                                                    disabled={isActioning}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-red-200
                                                               text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                >
                                                    <XCircle className="w-4 h-4" /> Reject
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleApprove(week)}
                                                disabled={isActioning || isRejecting}
                                                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white
                                                           bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                {isActioning ? 'Processing...' : 'Approve'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Reject reason panel */}
                                    {isRejecting && (
                                        <div className="border-t border-red-100 bg-red-50 px-6 py-5">
                                            <p className="text-sm font-semibold text-red-700 mb-2">
                                                Rejection reason for {week.employeeName.split(' ')[0]}
                                            </p>
                                            <textarea
                                                autoFocus
                                                rows={3}
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                className="w-full px-4 py-3 border border-red-200 rounded-lg text-sm resize-none
                                                           focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                                                placeholder="e.g. Missing entries for Tuesday and Wednesday. Please complete and resubmit."
                                            />
                                            <div className="flex items-center gap-3 mt-3">
                                                <button
                                                    onClick={() => handleReject(week)}
                                                    disabled={!rejectReason.trim() || isActioning}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg
                                                               hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    {isActioning ? 'Rejecting...' : 'Confirm Rejection'}
                                                </button>
                                                <button
                                                    onClick={() => { setRejectingKey(null); setRejectReason('') }}
                                                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <p className="ml-auto text-xs text-red-500 hidden sm:block">
                                                    Timesheet returns to draft for employee to amend and resubmit.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Day breakdown table */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-200">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 border-b border-gray-200">
                                                        <tr>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Day</th>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clock In</th>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clock Out</th>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Break</th>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                                                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Comments</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {week.days.map(day => (
                                                            <tr key={day.id} className="hover:bg-blue-50/30 transition-colors">
                                                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{day.dayName}</td>
                                                                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{day.dateFormatted}</td>
                                                                <td className="px-6 py-4 font-mono text-gray-700">{fmtTime(day.clockIn)}</td>
                                                                <td className="px-6 py-4 font-mono text-gray-700">{fmtTime(day.clockOut)}</td>
                                                                <td className="px-6 py-4 text-gray-600">{fmtBreak(day.breakMins)}</td>
                                                                <td className="px-6 py-4">
                                                                    <span className="font-semibold text-blue-700">
                                                                        {day.totalHours > 0 ? `${day.totalHours.toFixed(2)}h` : '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 max-w-xs">
                                                                    {day.comments.length > 0 ? (
                                                                        <div className="space-y-2">
                                                                            {day.comments.map(c => (
                                                                                <div key={c.id} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                                                                    <p className="text-xs text-gray-800 leading-relaxed">{c.text}</p>
                                                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                                                        {c.authorName} &bull; {fmtCommentTime(c.createdAt)}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-300">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-3 text-sm font-semibold text-gray-700">
                                                                Week Total
                                                            </td>
                                                            <td className="px-6 py-3 font-bold text-blue-700 text-sm">
                                                                {week.totalHours.toFixed(2)}h
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>

                                            {/* Bottom action bar */}
                                            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
                                                <span className="text-xs text-gray-400 mr-auto">
                                                    {week.totalDays} working day{week.totalDays !== 1 ? 's' : ''} &bull; {week.totalHours.toFixed(1)}h total
                                                </span>
                                                {!isRejecting && (
                                                    <button
                                                        onClick={() => { setRejectingKey(key); setRejectReason('') }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleApprove(week)}
                                                    disabled={isActioning || isRejecting}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </ProtectedRoute>
    )
}
