// components/calendar/TeamCalendarGrid.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
    const ts = new Date().toISOString()
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
    data !== undefined
        ? fn(`[${ts}] [${level}] [TeamCalendarGrid] ${message}`, data)
        : fn(`[${ts}] [${level}] [TeamCalendarGrid] ${message}`)
}

interface FilterState {
    search: string
    locations: string[]
    roles: string[]
    teams: string[]
    selectedTeamId: string
}

interface TeamCalendarGridProps {
    startDate: Date
    endDate: Date
    filters: FilterState
    currentUserTeamId: string | null
    canViewAllTeams: boolean
}

interface Employee {
    id: string
    first_name: string
    last_name: string
    position: string | null
    profile_picture_url: string | null
    team_id: string | null
    team_name: string | null
    work_location: string | null
}

interface LeaveRecord {
    id: string
    employee_id: string | null
    start_date: string
    end_date: string
    leave_type: string
    status: string | null
    total_days: number
    reason: string | null
}

interface DayCell {
    date: Date
    dateStr: string
    dayName: string
    dayNum: number
    monthName: string
    isWeekend: boolean
    isToday: boolean
}

interface TeamGroup {
    teamId: string | null
    teamName: string
    employees: Employee[]
}

const EMPLOYEES_PER_PAGE = 10

export default function TeamCalendarGrid({
    startDate,
    endDate,
    filters,
    currentUserTeamId,
    canViewAllTeams,
}: TeamCalendarGridProps) {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [leaves, setLeaves] = useState<LeaveRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedLeave, setSelectedLeave] = useState<{
        leave: LeaveRecord
        employee: Employee
    } | null>(null)
    const [teamPages, setTeamPages] = useState<Record<string, number>>({})
    const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({})

    const supabase = createClient()

    useEffect(() => {
        fetchCalendarData()
    }, [startDate, endDate, filters, currentUserTeamId, canViewAllTeams])

    const fetchCalendarData = async () => {
        try {
            setLoading(true)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                log('WARN', 'No authenticated user')
                setLoading(false)
                return
            }

            const { data: currentEmp } = await supabase
                .from('employees')
                .select('id, team_id, company_id')
                .eq('user_id', user.id)
                .single()

            if (!currentEmp?.company_id) {
                log('WARN', 'No employee/company record found')
                setEmployees([])
                setLeaves([])
                setLoading(false)
                return
            }

            let employeeQuery = supabase
                .from('employees')
                .select(`id, first_name, last_name, position, profile_picture_url, work_location, team_id, teams(name)`)
                .eq('company_id', currentEmp.company_id)
                .eq('is_active', true)

            // RBAC: Restrict to team if user can't view all
            if (!canViewAllTeams && currentEmp.team_id) {
                employeeQuery = employeeQuery.eq('team_id', currentEmp.team_id)
            }

            // Apply filters
            if (filters.search) {
                employeeQuery = employeeQuery.or(
                    `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`
                )
            }
            if (filters.locations.length > 0) {
                employeeQuery = employeeQuery.in('work_location', filters.locations)
            }
            if (filters.teams.length > 0) {
                employeeQuery = employeeQuery.in('team_id', filters.teams)
            }
            if (filters.roles.length > 0) {
                const { data: empRoles } = await supabase
                    .from('employee_roles')
                    .select('employee_id')
                    .in('role_id', filters.roles)

                const empIds = empRoles
                    ?.map(er => er.employee_id)
                    .filter((id): id is string => !!id) || []
                if (empIds.length > 0) {
                    employeeQuery = employeeQuery.in('id', empIds)
                } else {
                    setEmployees([])
                    setLeaves([])
                    setLoading(false)
                    return
                }
            }

            const { data: employeeData, error: empError } = await employeeQuery
                .order('first_name')
                .limit(200)

            if (empError || !employeeData) {
                log('ERROR', 'Failed to fetch employees', { error: empError?.message })
                setEmployees([])
                setLeaves([])
                setLoading(false)
                return
            }

            // Map to flat Employee structure
            const mapped: Employee[] = employeeData.map((e: Record<string, unknown>) => ({
                id: e.id as string,
                first_name: e.first_name as string,
                last_name: e.last_name as string,
                position: e.position as string | null,
                profile_picture_url: e.profile_picture_url as string | null,
                team_id: e.team_id as string | null,
                team_name: (e.teams as { name: string } | null)?.name || null,
                work_location: e.work_location as string | null,
            }))

            setEmployees(mapped)

            // Fetch leaves
            const employeeIds = mapped.map(e => e.id)
            if (employeeIds.length === 0) {
                setLeaves([])
                setLoading(false)
                return
            }

            const startDateStr = startDate.toISOString().split('T')[0]
            const endDateStr = endDate.toISOString().split('T')[0]

            const { data: leaveData, error: leaveError } = await supabase
                .from('leaves')
                .select('id, employee_id, start_date, end_date, leave_type, status, total_days, reason')
                .in('employee_id', employeeIds)
                .in('status', ['approved', 'pending'])
                .or(`and(start_date.lte.${endDateStr},end_date.gte.${startDateStr})`)

            if (leaveError) {
                log('ERROR', 'Failed to fetch leaves', { error: leaveError.message })
                setLeaves([])
            } else {
                setLeaves((leaveData || []) as LeaveRecord[])
            }
        } catch (err) {
            log('ERROR', 'Unexpected error in fetchCalendarData', { error: err })
        } finally {
            setLoading(false)
        }
    }

    // Generate date range
    const dateRange = useMemo((): DayCell[] => {
        const days: DayCell[] = []
        const current = new Date(startDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0]
            const dayOfWeek = current.getDay()
            days.push({
                date: new Date(current),
                dateStr,
                dayName: current.toLocaleDateString('en-GB', { weekday: 'short' }),
                dayNum: current.getDate(),
                monthName: current.toLocaleDateString('en-GB', { month: 'short' }),
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isToday: current.getTime() === today.getTime(),
            })
            current.setDate(current.getDate() + 1)
        }
        return days
    }, [startDate, endDate])

    // Group employees by team, filtered by selectedTeamId
    const teamGroups = useMemo((): TeamGroup[] => {
        // If a specific team is selected, only show that team's employees
        const filteredEmployees = filters.selectedTeamId
            ? employees.filter(emp => emp.team_id === filters.selectedTeamId)
            : employees

        const groupMap = new Map<string, TeamGroup>()

        for (const emp of filteredEmployees) {
            const key = emp.team_id || '__no_team__'
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    teamId: emp.team_id,
                    teamName: emp.team_name || 'Unassigned',
                    employees: [],
                })
            }
            groupMap.get(key)!.employees.push(emp)
        }

        // Sort teams alphabetically, unassigned last
        return Array.from(groupMap.values()).sort((a, b) => {
            if (!a.teamId) return 1
            if (!b.teamId) return -1
            return a.teamName.localeCompare(b.teamName)
        })
    }, [employees, filters.selectedTeamId])

    // Reset pages when data changes
    useEffect(() => {
        setTeamPages({})
    }, [employees.length])

    // Get leaves for a specific employee and date
    const getLeavesForDate = (employeeId: string, dateStr: string): LeaveRecord[] => {
        return leaves.filter(leave => {
            if (!leave.employee_id || leave.employee_id !== employeeId) return false
            return dateStr >= leave.start_date && dateStr <= leave.end_date
        })
    }

    // Leave color
    const getLeaveColor = (leave: LeaveRecord): { bg: string; text: string; border: string } => {
        const status = leave.status || 'pending'
        if (status === 'pending') {
            return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' }
        }
        switch (leave.leave_type) {
            case 'annual_leave':
                return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' }
            case 'sick_leave':
                return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }
            case 'work_from_home':
                return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' }
            case 'unpaid_leave':
                return { bg: 'bg-gray-200', text: 'text-gray-800', border: 'border-gray-400' }
            default:
                return { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' }
        }
    }

    const getLeaveLabel = (leave: LeaveRecord): string => {
        const status = leave.status || 'pending'
        if (status === 'pending') return 'P'
        switch (leave.leave_type) {
            case 'annual_leave': return 'AL'
            case 'sick_leave': return 'SL'
            case 'work_from_home': return 'WFH'
            case 'unpaid_leave': return 'UL'
            default: return 'L'
        }
    }

    const formatLeaveType = (type: string) => {
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }

    // Scroll handlers per team
    const handleScroll = (teamKey: string, direction: 'left' | 'right') => {
        const container = scrollRefs.current[teamKey]
        if (container) {
            container.scrollBy({ left: direction === 'left' ? -400 : 400, behavior: 'smooth' })
        }
    }

    const getTeamPage = (teamKey: string) => teamPages[teamKey] || 0
    const setTeamPage = (teamKey: string, page: number) => {
        setTeamPages(prev => ({ ...prev, [teamKey]: page }))
    }

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12">
                <div className="flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <span className="ml-3 text-gray-600">Loading calendar...</span>
                </div>
            </div>
        )
    }

    const hasActiveFilters = filters.search || filters.locations.length > 0 ||
        filters.roles.length > 0 || filters.teams.length > 0 || filters.selectedTeamId

    if (employees.length === 0 || teamGroups.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No employees found</p>
                <p className="text-sm text-gray-500">
                    {hasActiveFilters
                        ? 'Try adjusting your filters or selecting a different team'
                        : 'There are no employees in your team'}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {teamGroups.map(group => {
                const teamKey = group.teamId || '__no_team__'
                const currentPage = getTeamPage(teamKey)
                const totalPages = Math.ceil(group.employees.length / EMPLOYEES_PER_PAGE)
                const paginatedEmployees = group.employees.slice(
                    currentPage * EMPLOYEES_PER_PAGE,
                    (currentPage + 1) * EMPLOYEES_PER_PAGE
                )

                return (
                    <div
                        key={teamKey}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                    >
                        {/* Team Header */}
                        <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-700">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-semibold text-white">
                                    {group.teamName}
                                </h3>
                                <span className="text-xs text-gray-300 bg-gray-600 px-2 py-0.5 rounded-full">
                                    {group.employees.length} member{group.employees.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleScroll(teamKey, 'left')}
                                    className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded-md transition-colors"
                                    title="Scroll left"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleScroll(teamKey, 'right')}
                                    className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded-md transition-colors"
                                    title="Scroll right"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Table */}
                        <div className="overflow-hidden">
                            <div
                                ref={el => { scrollRefs.current[teamKey] = el }}
                                className="overflow-x-auto"
                            >
                                <table className="w-full border-collapse" style={{ minWidth: `${dateRange.length * 48 + 240}px` }}>
                                    {/* Date Header Row */}
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-4 py-2 text-left min-w-[240px] w-[240px]">
                                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    Employee
                                                </span>
                                            </th>
                                            {dateRange.map(day => (
                                                <th
                                                    key={day.dateStr}
                                                    className={`border-r border-gray-200 px-0 py-2 text-center min-w-[48px] w-[48px] ${
                                                        day.isToday
                                                            ? 'bg-blue-50'
                                                            : day.isWeekend
                                                                ? 'bg-gray-100'
                                                                : 'bg-gray-50'
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-center leading-tight">
                                                        <span className={`text-[10px] font-medium ${
                                                            day.isToday ? 'text-blue-600' : day.isWeekend ? 'text-gray-400' : 'text-gray-500'
                                                        }`}>
                                                            {day.dayName}
                                                        </span>
                                                        <span className={`text-sm font-bold ${
                                                            day.isToday ? 'text-blue-600' : day.isWeekend ? 'text-gray-400' : 'text-gray-800'
                                                        }`}>
                                                            {day.dayNum}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    {/* Employee Rows */}
                                    <tbody>
                                        {paginatedEmployees.map((employee, idx) => (
                                            <tr
                                                key={employee.id}
                                                className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                                }`}
                                            >
                                                {/* Employee Info Cell */}
                                                <td className="sticky left-0 z-10 border-r border-gray-200 px-4 py-3 min-w-[240px] w-[240px] bg-inherit">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={`${employee.first_name} ${employee.last_name}`}
                                                            imageUrl={employee.profile_picture_url}
                                                            size="sm"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                                {employee.first_name} {employee.last_name}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {employee.position || 'No position'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Date Cells */}
                                                {dateRange.map(day => {
                                                    const dayLeaves = getLeavesForDate(employee.id, day.dateStr)
                                                    const leave = dayLeaves[0]

                                                    return (
                                                        <td
                                                            key={day.dateStr}
                                                            className={`border-r border-gray-100 text-center p-1 min-w-[48px] w-[48px] ${
                                                                day.isToday
                                                                    ? 'bg-blue-50/60'
                                                                    : day.isWeekend
                                                                        ? 'bg-gray-100/60'
                                                                        : ''
                                                            }`}
                                                        >
                                                            {leave ? (
                                                                <button
                                                                    onClick={() => setSelectedLeave({ leave, employee })}
                                                                    className={`w-full py-2 rounded text-xs font-bold border cursor-pointer
                                                                        hover:opacity-80 transition-opacity
                                                                        ${getLeaveColor(leave).bg} ${getLeaveColor(leave).text} ${getLeaveColor(leave).border}`}
                                                                    title={`${formatLeaveType(leave.leave_type)} (${leave.status || 'pending'})`}
                                                                >
                                                                    {day.dayNum}
                                                                </button>
                                                            ) : (
                                                                <span className={`inline-block py-2 text-xs font-medium ${
                                                                    day.isToday
                                                                        ? 'text-blue-600 font-bold'
                                                                        : day.isWeekend
                                                                            ? 'text-gray-400'
                                                                            : 'text-gray-500'
                                                                }`}>
                                                                    {day.dayNum}
                                                                </span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-2.5 border-t border-gray-200 bg-gray-50">
                                <p className="text-xs text-gray-500">
                                    Showing {currentPage * EMPLOYEES_PER_PAGE + 1}
                                    &ndash;
                                    {Math.min((currentPage + 1) * EMPLOYEES_PER_PAGE, group.employees.length)} of {group.employees.length}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setTeamPage(teamKey, currentPage - 1)}
                                        disabled={currentPage === 0}
                                        className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md
                                                   hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Prev
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setTeamPage(teamKey, i)}
                                            className={`w-7 h-7 text-xs font-medium rounded-md transition-colors ${
                                                i === currentPage
                                                    ? 'bg-gray-800 text-white'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setTeamPage(teamKey, currentPage + 1)}
                                        disabled={currentPage >= totalPages - 1}
                                        className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md
                                                   hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Leave Details Modal */}
            {selectedLeave && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedLeave(null)}
                >
                    <div
                        className="bg-white rounded-xl max-w-md w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Leave Details</h3>
                            <button
                                onClick={() => setSelectedLeave(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            {/* Employee */}
                            <div className="flex items-center gap-3">
                                <Avatar
                                    name={`${selectedLeave.employee.first_name} ${selectedLeave.employee.last_name}`}
                                    imageUrl={selectedLeave.employee.profile_picture_url}
                                    size="md"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {selectedLeave.employee.first_name} {selectedLeave.employee.last_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {selectedLeave.employee.position || 'No position'}
                                        {selectedLeave.employee.team_name ? ` - ${selectedLeave.employee.team_name}` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Leave Type</span>
                                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                                        {formatLeaveType(selectedLeave.leave.leave_type)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
                                    <div className="mt-1">
                                        <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                            selectedLeave.leave.status === 'approved'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {selectedLeave.leave.status || 'pending'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Start Date</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                        {new Date(selectedLeave.leave.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">End Date</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                        {new Date(selectedLeave.leave.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</span>
                                    <p className="text-sm text-gray-900 mt-0.5">
                                        {selectedLeave.leave.total_days} day{selectedLeave.leave.total_days !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>

                            {selectedLeave.leave.reason && (
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</span>
                                    <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg p-3 italic">
                                        &ldquo;{selectedLeave.leave.reason}&rdquo;
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                            <button
                                onClick={() => setSelectedLeave(null)}
                                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg text-sm
                                           font-medium hover:bg-gray-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
