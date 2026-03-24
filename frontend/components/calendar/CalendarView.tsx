// components/calendar/CalendarView.tsx
'use client'

import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { createClient } from '@/lib/supabase/client'
import type { LeaveWithEmployee } from '@/types/leave'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [CalendarView] ${message}`, data)
    : fn(`[${ts}] [${level}] [CalendarView] ${message}`)
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: {
    leave: LeaveWithEmployee
    employeeName: string
    leaveType: string
    status: string
  }
}

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'CalendarView mounted — fetching calendar data')

    const fetch = async () => {
      try {
        // ── Step 1: auth ──────────────────────────────────────────────────────
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
          log('WARN', 'No authenticated user — calendar will not load')
          setLoading(false)
          return
        }

        log('DEBUG', 'Auth user resolved', { userId: user.id })

        // ── Step 2: resolve employee + company ────────────────────────────────
        const { data: emp, error: empError } = await supabase
          .from('employees')
          .select('id, team_id, company_id')
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

        if (!emp?.company_id) {
          log('WARN', 'Employee has no company_id — cannot scope calendar data', {
            employeeId: emp?.id,
            hint: 'Assign this employee to a company',
          })
          setLoading(false)
          return
        }

        log('DEBUG', 'Employee resolved', {
          employeeId: emp.id,
          teamId: emp.team_id ?? 'none',
          companyId: emp.company_id,
        })

        // ── Step 3: fetch leaves ──────────────────────────────────────────────
        log('DEBUG', 'Fetching approved and pending leaves for company', {
          companyId: emp.company_id,
        })

        const { data: leaves, error: leavesError } = await supabase
          .from('leaves')
          .select(`
            *,
            employee:employees!leaves_employee_id_fkey(
              id, first_name, last_name, position, profile_picture_url, email
            )
          `)
          .eq('employees.company_id', emp.company_id)
          .in('status', ['approved', 'pending'])

        if (leavesError) {
          log('ERROR', 'Failed to fetch leaves', {
            companyId: emp.company_id,
            code: leavesError.code,
            message: leavesError.message,
            details: leavesError.details,
          })
          // Non-fatal — continue to load holidays even if leaves fail
        } else {
          log('INFO', `Fetched ${leaves?.length ?? 0} leave(s)`, {
            approved: leaves?.filter(l => l.status === 'approved').length ?? 0,
            pending: leaves?.filter(l => l.status === 'pending').length ?? 0,
          })

          if (leaves?.length === 0) {
            log('DEBUG', 'No leaves returned — this may be expected or a RLS/filter issue', {
              companyId: emp.company_id,
              hint: 'Check that employees.company_id filter is working correctly with the join',
            })
          }
        }

        // ── Step 4: fetch holidays ────────────────────────────────────────────
        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
        const yearEnd   = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]

        log('DEBUG', 'Fetching holidays for current year', {
          companyId: emp.company_id,
          yearStart,
          yearEnd,
        })

        const { data: holidays, error: holidaysError } = await supabase
          .from('holidays')
          .select('*')
          .eq('company_id', emp.company_id)
          .gte('date', yearStart)
          .lte('date', yearEnd)

        if (holidaysError) {
          log('ERROR', 'Failed to fetch holidays', {
            companyId: emp.company_id,
            code: holidaysError.code,
            message: holidaysError.message,
            details: holidaysError.details,
          })
          // Non-fatal — continue with leave events only
        } else {
          log('INFO', `Fetched ${holidays?.length ?? 0} holiday(s) for ${new Date().getFullYear()}`)
        }

        // ── Step 5: map leaves to calendar events ─────────────────────────────
        log('DEBUG', 'Mapping leaves to calendar events')

        const leaveEvents: CalendarEvent[] = (leaves as any)?.map((leave: LeaveWithEmployee) => {
          const employeeName = leave.employee
            ? `${leave.employee.first_name} ${leave.employee.last_name}`
            : 'Unknown'

          if (!leave.employee) {
            log('WARN', 'Leave record has no joined employee data — will display as "Unknown"', {
              leaveId: leave.id,
              employeeId: leave.employee_id,
              hint: 'The employees join may be filtered out by RLS or company_id mismatch',
            })
          }

          const leaveTypeShort = {
            annual_leave:   'Annual',
            sick_leave:     'Sick',
            work_from_home: 'WFH',
            unpaid_leave:   'Unpaid',
            other:          'Other',
          }[leave.leave_type] || 'Leave'

          if (!['annual_leave', 'sick_leave', 'work_from_home', 'unpaid_leave', 'other']
              .includes(leave.leave_type)) {
            log('WARN', 'Unrecognised leave_type — will render as "Leave"', {
              leaveId: leave.id,
              leave_type: leave.leave_type,
            })
          }

          const colors = {
            annual_leave:   { bg: '#3b82f6', border: '#2563eb' },
            sick_leave:     { bg: '#ef4444', border: '#dc2626' },
            work_from_home: { bg: '#8b5cf6', border: '#7c3aed' },
            unpaid_leave:   { bg: '#6b7280', border: '#4b5563' },
            other:          { bg: '#14b8a6', border: '#0d9488' },
          }

          const color = colors[leave.leave_type as keyof typeof colors] || colors.other
          const isPending = leave.status === 'pending'

          // Add 1 day to end_date because FullCalendar's end is exclusive
          const endExclusive = new Date(new Date(leave.end_date).getTime() + 86400000)
            .toISOString().split('T')[0]

          if (isNaN(new Date(leave.start_date).getTime())) {
            log('WARN', 'Leave has invalid start_date — event may not render correctly', {
              leaveId: leave.id,
              start_date: leave.start_date,
            })
          }

          if (isNaN(new Date(leave.end_date).getTime())) {
            log('WARN', 'Leave has invalid end_date — event may not render correctly', {
              leaveId: leave.id,
              end_date: leave.end_date,
            })
          }

          return {
            id: leave.id,
            title: `${employeeName} - ${leaveTypeShort}${isPending ? ' (Pending)' : ''}`,
            start: leave.start_date,
            end: endExclusive,
            backgroundColor: isPending ? '#fbbf24' : color.bg,
            borderColor: isPending ? '#f59e0b' : color.border,
            textColor: '#ffffff',
            extendedProps: {
              leave,
              employeeName,
              leaveType: leaveTypeShort,
              status: leave.status || 'pending',
            },
          }
        }) ?? []

        log('DEBUG', `Mapped ${leaveEvents.length} leave event(s)`)

        // ── Step 6: map holidays to calendar events ───────────────────────────
        const holidayEvents: CalendarEvent[] = (holidays ?? []).map((holiday: any) => {
          if (!holiday.name || !holiday.date) {
            log('WARN', 'Holiday record missing name or date — event may not render', {
              holidayId: holiday.id,
              name: holiday.name ?? '(missing)',
              date: holiday.date ?? '(missing)',
            })
          }

          return {
            id: `holiday-${holiday.id}`,
            title: `🎉 ${holiday.name}`,
            start: holiday.date,
            end: holiday.date,
            backgroundColor: '#dcfce7',
            borderColor: '#86efac',
            textColor: '#166534',
            extendedProps: {
              leave: null as any,
              employeeName: '',
              leaveType: 'Holiday',
              status: 'holiday',
            },
            display: 'background',
          }
        })

        log('DEBUG', `Mapped ${holidayEvents.length} holiday event(s)`)

        const totalEvents = leaveEvents.length + holidayEvents.length
        log('INFO', `Calendar loaded with ${totalEvents} total event(s)`, {
          leaveEvents: leaveEvents.length,
          holidayEvents: holidayEvents.length,
        })

        setEvents([...leaveEvents, ...holidayEvents])

      } catch (err) {
        log('ERROR', 'Unexpected exception in CalendarView fetch()', {
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white border border-gray-200 rounded-xl">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left:   'prev,next today',
          center: 'title',
          right:  'dayGridMonth,timeGridWeek,listWeek',
        }}
        events={events}
        height="auto"
        eventClick={(info) => {
          const leave = info.event.extendedProps.leave
          if (leave) {
            log('DEBUG', 'Calendar event clicked — navigating to leave detail', {
              leaveId: leave.id,
              employeeName: info.event.extendedProps.employeeName,
              leaveType: info.event.extendedProps.leaveType,
            })
            window.location.href = `/leaves/${leave.id}`
          } else {
            log('DEBUG', 'Calendar event clicked but has no leave data (holiday)', {
              title: info.event.title,
            })
          }
        }}
        eventTimeFormat={{
          hour:     'numeric',
          minute:   '2-digit',
          meridiem: 'short',
        }}
        eventContent={(arg) => {
          const { employeeName, leaveType, status } = arg.event.extendedProps

          if (arg.view.type === 'listWeek') {
            return {
              html: `
                <div class="flex items-center gap-2 p-2">
                  <div class="w-2 h-2 rounded-full" style="background: ${arg.event.backgroundColor}"></div>
                  <div class="flex-1">
                    <div class="font-medium text-sm">${employeeName}</div>
                    <div class="text-xs text-gray-500">${leaveType} ${status === 'pending' ? '(Pending Approval)' : ''}</div>
                  </div>
                </div>
              `,
            }
          }

          return { html: `<div class="fc-event-title truncate">${arg.event.title}</div>` }
        }}
      />
    </div>
  )
}