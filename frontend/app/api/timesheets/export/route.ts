// app/api/timesheets/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server' // ← update if needed
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { ROLES } from '@/lib/rbac'

// ── Company logo (base64 embedded — no file path dependency) ──────────────────
const LOGO_BASE64 = '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'


// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateType = 'detailed' | 'summary'

interface ExportRequestBody {
  employeeId: string
  monthYear: string        // e.g. "2025-11"
  templateType: TemplateType
  columns: string[]      // selected column keys
  includeSignatures?: boolean
}

// ── Column definitions ────────────────────────────────────────────────────────

const ALL_COLUMNS: Record<string, { label: string; class: string }> = {
  date: { label: 'Date', class: 'date-col' },
  clock_in: { label: 'In', class: '' },
  clock_out: { label: 'Out', class: '' },
  break: { label: 'Break', class: '' },
  total_leave: { label: 'Total leave', class: '' },
  regular_hours: { label: 'Regular hours', class: '' },
  status: { label: 'Status', class: '' },
  comments: { label: 'Comments', class: 'comments-col' },
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: ExportRequestBody = await req.json()
    const { employeeId, monthYear, templateType, columns, includeSignatures } = body

    if (!employeeId || !monthYear || !templateType || !columns?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // ── Auth check ─────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Fetch employee ──────────────────────────────────────────────────────
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number, company_id')
      .eq('id', employeeId)
      .single()

    if (empError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Only allow: the employee themselves, or a manager in the same company
    const { data: requestingEmp } = await supabase
      .from('employees')
      .select('id, company_id, manager_id, employee_roles!employee_roles_employee_id_fkey(role_id, roles(name))')
      .eq('user_id', user.id)
      .single()

    if (!requestingEmp) {
      return NextResponse.json({ error: 'Requesting employee not found' }, { status: 403 })
    }

    const requestingRoles: string[] = Array.isArray(requestingEmp.employee_roles)
      ? requestingEmp.employee_roles.map((r: any) => r.roles?.name).filter(Boolean)
      : []
    const isManager = requestingRoles.some(r =>
      [ROLES.ADMIN, ROLES.SYSTEM_ADMIN, ROLES.TEAM_LEAD, ROLES.HR_MANAGER].includes(r as any)
    )
    const isSelf = requestingEmp.id === employeeId
    const sameCompany = requestingEmp.company_id === employee.company_id

    if (!isSelf && !(isManager && sameCompany)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // ── Fetch company ───────────────────────────────────────────────────────
    const { data: company } = employee.company_id
      ? await supabase.from('companies').select('name').eq('id', employee.company_id).single()
      : { data: null }

    // ── Fetch timesheets for the month ──────────────────────────────────────
    const [year, month] = monthYear.split('-').map(Number)
    const firstDay = `${monthYear}-01`
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0] // last day of month

    const { data: sheets, error: sheetsError } = await supabase
      .from('timesheets')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: true })

    if (sheetsError) {
      return NextResponse.json({ error: 'Failed to fetch timesheets' }, { status: 500 })
    }

    // Fetch comments for all timesheet IDs
    const timesheetIds = (sheets ?? []).map((s: any) => s.id)
    let commentsMap: Record<string, string[]> = {}

    if (timesheetIds.length > 0) {
      const { data: comments } = await supabase
        .from('timesheet_comments')
        .select('timesheet_id, comment_text')
        .in('timesheet_id', timesheetIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

        ; (comments ?? []).forEach((c: any) => {
          if (!commentsMap[c.timesheet_id]) commentsMap[c.timesheet_id] = []
          commentsMap[c.timesheet_id].push(c.comment_text)
        })
    }

    // ── Build a map of date → sheet ─────────────────────────────────────────
    const sheetsByDate: Record<string, any> = {}
      ; (sheets ?? []).forEach((s: any) => { sheetsByDate[s.date] = s })

    // ── Build all calendar days for the month ───────────────────────────────
    const daysInMonth = new Date(year, month, 0).getDate()
    const allDays: any[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthYear}-${String(d).padStart(2, '0')}`
      const dateObj = new Date(dateStr + 'T00:00:00')
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
      const sheet = sheetsByDate[dateStr]

      allDays.push({
        date: dateStr,
        dateObj,
        isWeekend,
        sheet: sheet ?? null,
        comments: sheet ? (commentsMap[sheet.id] ?? []) : [],
      })
    }

    // ── Fetch leaves for the month ─────────────────────────────────────────
    const { data: leaveRecords } = await supabase
      .from('leaves')
      .select('start_date, end_date, leave_type, status, days_requested')
      .eq('employee_id', employeeId)
      .in('status', ['approved', 'pending'])
      .or(`start_date.lte.${lastDay},end_date.gte.${firstDay}`)

    // ── Time-off requests ── (table not in schema; extend later if added)
    const timeOffRecords: any[] = []

    // ── Compute totals ──────────────────────────────────────────────────────
    const totalHours = allDays.reduce((s, d) => s + (d.sheet?.total_hours ?? 0), 0)
    const totalOvertimeHours = allDays.reduce((s, d) => s + (d.sheet?.overtime_hours ?? 0), 0)

    // Office vs remote days
    const officeDays = allDays.filter(d => d.sheet?.work_location === 'office' && d.sheet?.total_hours > 0).length
    const remoteDays = allDays.filter(d => d.sheet?.work_location === 'remote' && d.sheet?.total_hours > 0).length
    const workedDays = allDays.filter(d => !d.isWeekend && d.sheet?.total_hours > 0).length

    // Weekend days that still have hours (weekend work)
    const weekendWorkedDays = allDays.filter(d => d.isWeekend && d.sheet?.total_hours > 0).length

    // Calendar working days in the month (Mon–Fri only)
    const calendarWorkingDays = allDays.filter(d => !d.isWeekend).length

    // Days with no entry (absent / no timesheet)
    const absentDays = allDays.filter(d => !d.isWeekend && !d.sheet).length

    // Leave stats — sum days_requested for records overlapping this month
    const approvedLeaves = (leaveRecords ?? []).filter((l: any) => l.status === 'approved')
    const pendingLeaves = (leaveRecords ?? []).filter((l: any) => l.status === 'pending')
    const totalLeaveDays = approvedLeaves.reduce((s: number, l: any) => s + (Number(l.days_requested) || 0), 0)
    const pendingLeaveDays = pendingLeaves.reduce((s: number, l: any) => s + (Number(l.days_requested) || 0), 0)

    // Leave breakdown by type
    const leaveByType: Record<string, number> = {}
    approvedLeaves.forEach((l: any) => {
      const t = l.leave_type ?? 'Other'
      leaveByType[t] = (leaveByType[t] ?? 0) + (Number(l.days_requested) || 0)
    })

    // Time-off stats
    const approvedTimeOff = (timeOffRecords ?? []).filter((t: any) => t.status === 'approved')
    const totalTimeOffHours = approvedTimeOff.reduce((s: number, t: any) => s + (Number(t.hours_requested) || 0), 0)
    const totalTimeOffDays = approvedTimeOff.length  // count of approved time-off requests

    // Attendance rate (worked / calendar working days)
    const attendanceRate = calendarWorkingDays > 0
      ? Math.round((workedDays / calendarWorkingDays) * 100)
      : 0

    const workingDays = workedDays
    const totalLeaveHrs = 0

    // ── Build column definitions for selected columns ───────────────────────
    const selectedColumns = columns
      .filter(c => ALL_COLUMNS[c])
      .map(c => ({ key: c, ...ALL_COLUMNS[c] }))

    // ── Build rows ──────────────────────────────────────────────────────────
    const rows = allDays.map(day => {
      const s = day.sheet
      const statusClass =
        s?.status === 'approved' ? 'status-approved' :
          s?.status === 'submitted' ? 'status-submitted' : 'status-draft'

      const cellMap: Record<string, { value: string; class: string; statusClass?: string }> = {
        date: { value: formatDateDisplay(day.date), class: 'date-col' },
        clock_in: { value: s?.clock_in ? formatTime(s.clock_in) : '00:00', class: '' },
        clock_out: { value: s?.clock_out ? formatTime(s.clock_out) : '00:00', class: '' },
        break: { value: s?.break_time_minutes ? formatBreak(s.break_time_minutes) : '00:00', class: '' },
        total_leave: { value: '00:00', class: '' },
        regular_hours: { value: s?.total_hours ? formatHoursDisplay(s.total_hours) : '00:00', class: '' },
        status: { value: capitalise(s?.status ?? ''), class: '', statusClass },
        comments: { value: day.comments.join('\n'), class: 'comments-col' },
      }

      return {
        isWeekend: day.isWeekend,
        cells: selectedColumns.map(col => cellMap[col.key] ?? { value: '', class: '' }),
      }
    })

    // ── Period label ────────────────────────────────────────────────────────
    const periodLabel = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric',
    })

    // ── Determine colspan for footer ────────────────────────────────────────
    const regularHoursIndex = columns.indexOf('regular_hours')
    const totalLeaveIndex = columns.indexOf('total_leave')
    const hasStatus = columns.includes('status')
    const hasComments = columns.includes('comments')

    // colspan = everything before regular_hours (or total_leave for detailed)
    const footerColspan = templateType === 'detailed'
      ? (totalLeaveIndex >= 0 ? totalLeaveIndex : selectedColumns.length - 1)
      : (regularHoursIndex >= 0 ? regularHoursIndex : selectedColumns.length - 1)

    // ── Template data ───────────────────────────────────────────────────────
    const templateData = {
      COMPANY_NAME: company?.name ?? '',
      EMPLOYEE_NAME: `${employee.first_name} ${employee.last_name}`,
      EMPLOYEE_NUMBER: employee.employee_number ?? '',
      GENERATED_DATE: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      PERIOD_LABEL: periodLabel,
      TOTAL_WORKING_DAYS: workingDays.toString(),
      CALENDAR_WORKING_DAYS: calendarWorkingDays.toString(),
      TOTAL_HOURS: formatHoursDisplay(totalHours),
      OVERTIME_HOURS: formatHoursDisplay(totalOvertimeHours),
      TOTAL_LEAVE: formatHoursDisplay(totalLeaveHrs),
      OFFICE_DAYS: officeDays.toString(),
      REMOTE_DAYS: remoteDays.toString(),
      WEEKEND_WORKED: weekendWorkedDays.toString(),
      ABSENT_DAYS: absentDays.toString(),
      ATTENDANCE_RATE: attendanceRate.toString(),
      LEAVE_DAYS: totalLeaveDays.toString(),
      PENDING_LEAVE_DAYS: pendingLeaveDays.toString(),
      LEAVE_BY_TYPE: Object.entries(leaveByType).map(([t, d]) => `${t}: ${d} day${d !== 1 ? 's' : ''}`).join(' &nbsp;|&nbsp; ') || '—',
      TIME_OFF_REQUESTS: totalTimeOffDays.toString(),
      TIME_OFF_HOURS: formatHoursDisplay(totalTimeOffHours),
      COLUMNS: selectedColumns,
      ROWS: rows,
      TOTAL_COLSPAN: footerColspan.toString(),
      SHOW_STATUS_COL: hasStatus,
      SHOW_COMMENTS_COL: hasComments,
      SHOW_WORKING_DAYS: true,
      SHOW_TOTAL_HOURS: true,
      SHOW_FOOTER: true,
      SHOW_SIGNATURES: includeSignatures ?? (templateType === 'detailed'),
    }

    // ── Load template and inject data ──────────────────────────────────────
    const templateFile = templateType === 'detailed'
      ? 'timesheet-detailed.html'
      : 'timesheet-summary.html'

    const templatePath = path.join(process.cwd(), 'templates', templateFile)
    let html = fs.readFileSync(templatePath, 'utf-8')

    // ── Build thead ─────────────────────────────────────────────────────────
    const theadHtml = selectedColumns
      .map(col => `<th class="${col.class ?? ''}">${col.label}</th>`)
      .join('')

    // ── Build tbody ─────────────────────────────────────────────────────────
    const tbodyHtml = rows.map(row => {
      const cells = row.cells
        .map((cell: any) => `<td class="${[cell.class, cell.statusClass].filter(Boolean).join(' ')}">${cell.value}</td>`)
        .join('')
      return `<tr class="${row.isWeekend ? 'weekend' : ''}">${cells}</tr>`
    }).join('')

    // ── Build tfoot ─────────────────────────────────────────────────────────
    const footerCells = selectedColumns.map((col, i) => {
      if (col.key === 'total_leave') return `<td>${templateData.TOTAL_LEAVE}</td>`
      if (col.key === 'regular_hours') return `<td>${templateData.TOTAL_HOURS}</td>`
      if (i === 0) return `<td class="label" style="text-align:left;font-weight:bold">Total</td>`
      return `<td></td>`
    }).join('')
    const tfootHtml = `<tr>${footerCells}</tr>`

    // ── Signature block ─────────────────────────────────────────────────────
    const sigHtml = (templateData.SHOW_SIGNATURES) ? `
      <div class="signature-section">
        <div class="signature-box">
          <div class="sig-label">Employee's signature</div>
          <div class="date-label">Date</div>
        </div>
        <div class="signature-box">
          <div class="sig-label">Employer's signature</div>
          <div class="date-label">Date</div>
        </div>
      </div>` : ''

    // ── Build stats summary block HTML ────────────────────────────────────────
    const statsHtml = `
      <div class="stats-section">
        <div class="stats-title">Monthly Summary</div>
        <div class="stats-grid">

          <div class="stat-card stat-blue">
            <div class="stat-label">Days Worked</div>
            <div class="stat-value">${templateData.TOTAL_WORKING_DAYS}</div>
            <div class="stat-sub">of ${templateData.CALENDAR_WORKING_DAYS} working days</div>
          </div>

          <div class="stat-card stat-green">
            <div class="stat-label">Total Hours</div>
            <div class="stat-value">${templateData.TOTAL_HOURS}</div>
            ${totalOvertimeHours > 0 ? `<div class="stat-sub">Overtime: ${templateData.OVERTIME_HOURS}</div>` : '<div class="stat-sub">No overtime</div>'}
          </div>

          <div class="stat-card stat-purple">
            <div class="stat-label">Attendance Rate</div>
            <div class="stat-value">${templateData.ATTENDANCE_RATE}%</div>
            <div class="stat-sub">${templateData.ABSENT_DAYS} day${absentDays !== 1 ? 's' : ''} absent</div>
          </div>

          <div class="stat-card stat-indigo">
            <div class="stat-label">Office Days</div>
            <div class="stat-value">${templateData.OFFICE_DAYS}</div>
            <div class="stat-sub">Remote: ${templateData.REMOTE_DAYS} day${remoteDays !== 1 ? 's' : ''}</div>
          </div>

          <div class="stat-card stat-orange">
            <div class="stat-label">Leave Taken</div>
            <div class="stat-value">${templateData.LEAVE_DAYS} day${totalLeaveDays !== 1 ? 's' : ''}</div>
            <div class="stat-sub">${pendingLeaveDays > 0 ? `${templateData.PENDING_LEAVE_DAYS} pending` : 'None pending'}</div>
          </div>

          <div class="stat-card stat-teal">
            <div class="stat-label">Time-Off</div>
            <div class="stat-value">${templateData.TIME_OFF_REQUESTS} request${totalTimeOffDays !== 1 ? 's' : ''}</div>
            <div class="stat-sub">${templateData.TIME_OFF_HOURS} hrs approved</div>
          </div>

        </div>

        ${weekendWorkedDays > 0 ? `<div class="stats-note">⚠ Weekend work: ${templateData.WEEKEND_WORKED} day${weekendWorkedDays !== 1 ? 's' : ''}</div>` : ''}
        ${Object.keys(leaveByType).length > 0 ? `<div class="stats-note">Leave breakdown: ${templateData.LEAVE_BY_TYPE}</div>` : ''}
      </div>`

    // ── Simple token replacement (no loops needed now) ──────────────────────
    const tokens: Record<string, string> = {
      '{{LOGO_BASE64}}': LOGO_BASE64,
      '{{COMPANY_NAME}}': templateData.COMPANY_NAME,
      '{{EMPLOYEE_NAME}}': templateData.EMPLOYEE_NAME,
      '{{EMPLOYEE_NUMBER}}': templateData.EMPLOYEE_NUMBER,
      '{{GENERATED_DATE}}': templateData.GENERATED_DATE,
      '{{PERIOD_LABEL}}': templateData.PERIOD_LABEL,
      '{{TOTAL_WORKING_DAYS}}': templateData.TOTAL_WORKING_DAYS,
      '{{TOTAL_HOURS}}': templateData.TOTAL_HOURS,
      '{{THEAD_ROWS}}': theadHtml,
      '{{TBODY_ROWS}}': tbodyHtml,
      '{{TFOOT_ROWS}}': tfootHtml,
      '{{SIGNATURE_BLOCK}}': sigHtml,
      '{{STATS_BLOCK}}': statsHtml,
      '{{EMPLOYEE_NUMBER_ROW}}': templateData.EMPLOYEE_NUMBER
        ? `<div class="meta-block">Employee number: <span>${templateData.EMPLOYEE_NUMBER}</span></div>`
        : '',
      '{{WORKING_DAYS_ROW}}': `<div class="working-days">Total Number of Working Days: <strong>${templateData.TOTAL_WORKING_DAYS}</strong></div>`,
    }

    for (const [token, value] of Object.entries(tokens)) {
      html = html.split(token).join(value)
    }

    // ── Generate PDF with Puppeteer ─────────────────────────────────────────
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
        displayHeaderFooter: false,
      })

      await browser.close()

      const filename = `timesheet_${employee.last_name}_${employee.first_name}_${monthYear}.pdf`
        .replace(/\s+/g, '_')
        .toLowerCase()

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (puppeteerErr) {
      await browser.close()
      throw puppeteerErr
    }

  } catch (err: any) {
    console.error('[TimesheetExport] Error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

// Template is now rendered directly via token replacement above

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(isoTime: string): string {
  // clock_in is stored as "2025-11-03T09:00:00"
  if (!isoTime) return '00:00'
  const parts = isoTime.split('T')
  return parts[1]?.slice(0, 5) ?? '00:00'
}

function formatBreak(mins: number): string {
  if (!mins) return '00:00'
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function formatHoursDisplay(hours: number): string {
  if (!hours) return '00:00'
  const h = Math.floor(hours).toString().padStart(2, '0')
  const m = Math.round((hours % 1) * 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}