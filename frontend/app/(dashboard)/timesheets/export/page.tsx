// app/(dashboard)/timesheets/export/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { ProtectedRoute, usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  FileDown, CheckSquare, Square, ChevronLeft, AlertCircle,
  Eye, Calendar, User
} from 'lucide-react'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', msg: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [ExportPage] ${msg}`, data)
    : fn(`[${ts}] [${level}] [ExportPage] ${msg}`)
}

// ── All available columns (always shown, user picks any combo) ────────────────
interface ColumnOption {
  key: string
  label: string
  description: string
  alwaysOn: boolean
}

const COLUMN_OPTIONS: ColumnOption[] = [
  { key: 'date', label: 'Date', description: 'Calendar date (DD/MM/YYYY)', alwaysOn: true },
  { key: 'clock_in', label: 'In', description: 'Time the employee clocked in', alwaysOn: false },
  { key: 'clock_out', label: 'Out', description: 'Time the employee clocked out', alwaysOn: false },
  { key: 'break', label: 'Break', description: 'Break duration (HH:MM)', alwaysOn: false },
  { key: 'total_leave', label: 'Total Leave', description: 'Leave hours taken on this day', alwaysOn: false },
  { key: 'regular_hours', label: 'Regular Hours', description: 'Total working hours for the day', alwaysOn: false },
  { key: 'status', label: 'Status', description: 'Approval status (Draft / Approved)', alwaysOn: false },
  { key: 'comments', label: 'Comments', description: 'Employee comments and task notes', alwaysOn: false },
]

// ── Presets define which columns + which layout template ──────────────────────
// templateType 'detailed' = includes In/Out/Break, signature boxes
// templateType 'summary'  = compact, comments-friendly, no signatures by default
const PRESETS: Record<string, {
  label: string
  description: string
  columns: string[]
  template: 'detailed' | 'summary'
  signatures: boolean
}> = {
  detailed: {
    label: 'Detailed Report',
    description: 'In/Out/Break times with signature boxes — matches Template 2',
    columns: ['date', 'clock_in', 'clock_out', 'break', 'total_leave', 'regular_hours', 'status'],
    template: 'detailed',
    signatures: true,
  },
  summary_comments: {
    label: 'Summary with Comments',
    description: 'Date, hours, status and task/ticket notes — matches Template 1 & 4',
    columns: ['date', 'regular_hours', 'status', 'comments'],
    template: 'summary',
    signatures: false,
  },
  simple: {
    label: 'Simple Hours',
    description: 'Just date, hours worked and approval status',
    columns: ['date', 'regular_hours', 'status'],
    template: 'summary',
    signatures: false,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCurrentMonthYear(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions(): { value: string; label: string }[] {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    })
  }
  return opts
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { hasPermission: canViewAllTimesheets } = usePermission(PERMISSIONS.TIMESHEETS.VIEW_ALL)
  const { hasPermission: canExport } = usePermission(PERMISSIONS.TIMESHEETS.EXPORT)
  const monthOptions = getMonthOptions()

  const [employees, setEmployees] = useState<any[]>([])
  const [currentEmp, setCurrentEmp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // ── Export config state ────────────────────────────────────────────────────
  const [selectedEmp, setSelectedEmp] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYear())
  const [selectedTemplate, setSelectedTemplate] = useState<'detailed' | 'summary'>('detailed')
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(PRESETS.detailed.columns))
  const [includeSignatures, setIncludeSignatures] = useState(true)
  const [activePreset, setActivePreset] = useState('detailed')

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  useEffect(() => {
    const empId = searchParams.get('employeeId')
    if (empId && employees.length > 0) setSelectedEmp(empId)
  }, [searchParams, employees])

  // ── Init ──────────────────────────────────────────────────────────────────
  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: emp } = await supabase
        .from('employees')
        .select('*, employee_roles!employee_roles_employee_id_fkey(role_id, roles(name)), team:teams(name)')
        .eq('user_id', user.id)
        .single()

      if (!emp) { setLoading(false); return }

      setCurrentEmp(emp)
      setSelectedEmp(emp.id)

      if (canViewAllTimesheets && emp.company_id) {
        const { data: team } = await supabase
          .from('employees')
          .select('id, first_name, last_name, team:teams(name)')
          .eq('company_id', emp.company_id)
          .eq('is_active', true)
          .order('first_name')
        setEmployees(team ?? [emp])
      } else {
        setEmployees([emp])
      }

      log('INFO', 'ExportPage initialised', { employeeId: emp.id, canViewAll: canViewAllTimesheets })
      setLoading(false)
    } catch (err: any) {
      log('ERROR', 'init() error', { error: err.message })
      setLoading(false)
    }
  }

  // ── Apply preset ──────────────────────────────────────────────────────────
  const applyPreset = (key: string) => {
    const preset = PRESETS[key]
    if (!preset) return
    setActivePreset(key)
    setSelectedColumns(new Set(preset.columns))
    setSelectedTemplate(preset.template)
    setIncludeSignatures(preset.signatures)
    log('DEBUG', 'Preset applied', { key, columns: preset.columns, template: preset.template })
  }

  // ── Toggle individual column ──────────────────────────────────────────────
  const toggleColumn = (key: string) => {
    if (key === 'date') return
    setActivePreset('custom')
    setSelectedColumns(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportError(null)
    if (!selectedEmp) { setExportError('Please select an employee.'); return }
    if (selectedColumns.size < 2) { setExportError('Select at least one column besides Date.'); return }

    // Always send columns in the order they appear in COLUMN_OPTIONS
    const columns = COLUMN_OPTIONS
      .filter(c => selectedColumns.has(c.key))
      .map(c => c.key)

    log('INFO', 'Exporting', { employeeId: selectedEmp, month: selectedMonth, template: selectedTemplate, columns })
    setExporting(true)

    try {
      const res = await fetch('/api/timesheets/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmp,
          monthYear: selectedMonth,
          templateType: selectedTemplate,
          columns,
          includeSignatures,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Export failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const empObj = employees.find(e => e.id === selectedEmp)
      a.href = url
      a.download = `timesheet_${empObj?.last_name ?? 'export'}_${selectedMonth}.pdf`.replace(/\s+/g, '_').toLowerCase()
      a.click()
      URL.revokeObjectURL(url)
      log('INFO', 'Export downloaded')
    } catch (err: any) {
      log('ERROR', 'Export failed', { error: err.message })
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  const selectedEmpObj = employees.find(e => e.id === selectedEmp)

  return (
    <ProtectedRoute permission={PERMISSIONS.TIMESHEETS.VIEW_OWN}>
      <div className="max-w-3xl mx-auto">

        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 border rounded-lg hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Export Timesheet</h1>
            <p className="text-sm text-gray-500">Choose your format and columns, then download as PDF.</p>
          </div>
        </div>

        {/* Error banner */}
        {exportError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {exportError}
            <button onClick={() => setExportError(null)} className="ml-auto">✕</button>
          </div>
        )}

        <div className="space-y-5">

          {/* ── Step 1: Employee & Month ───────────────────────────────────── */}
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Select Employee &amp; Period
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <User className="w-3.5 h-3.5 inline mr-1" />Employee
                </label>
                <select
                  value={selectedEmp}
                  onChange={e => setSelectedEmp(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}{e.team?.name ? ` — ${e.team.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {monthOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Step 2: Preset ────────────────────────────────────────────── */}
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
              Choose a Template
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`text-left p-4 border-2 rounded-xl transition-all ${activePreset === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <p className={`font-medium text-sm mb-1 ${activePreset === key ? 'text-blue-700' : 'text-gray-800'}`}>
                    {preset.label}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 3: Column picker (ALL columns always visible) ─────────── */}
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
              Customise Columns
            </h2>
            <p className="text-xs text-gray-500 mb-4 ml-8">Select which columns appear in the exported PDF.</p>

            <div className="grid grid-cols-2 gap-3">
              {COLUMN_OPTIONS.map(col => {
                const isOn = selectedColumns.has(col.key)
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    disabled={col.alwaysOn}
                    className={`flex items-start gap-3 p-3 border rounded-lg text-left transition-all
                      ${col.alwaysOn
                        ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200'
                        : isOn
                          ? 'border-blue-400 bg-blue-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                      }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isOn
                        ? <CheckSquare className={`w-4 h-4 ${col.alwaysOn ? 'text-gray-400' : 'text-blue-600'}`} />
                        : <Square className="w-4 h-4 text-gray-300" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{col.label}</p>
                      <p className="text-xs text-gray-500">{col.description}</p>
                      {col.alwaysOn && <p className="text-xs text-gray-400 mt-0.5 italic">Always included</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Step 4: Options ───────────────────────────────────────────── */}
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">4</span>
              Additional Options
            </h2>

            <div className="space-y-3">
              {/* Signature boxes toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Include signature boxes</p>
                  <p className="text-xs text-gray-500">Adds Employee &amp; Employer signature lines at the bottom</p>
                </div>
                <button
                  onClick={() => setIncludeSignatures(p => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${includeSignatures ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeSignatures ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Layout selector */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Layout</p>
                  <p className="text-xs text-gray-500">Detailed adds working days summary; Summary is compact</p>
                </div>
                <div className="flex gap-2">
                  {(['detailed', 'summary'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTemplate(t)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedTemplate === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Preview summary ───────────────────────────────────────────── */}
          <div className="bg-gray-50 border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-medium text-gray-700">Export Summary</p>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Employee:</span>{' '}
                {selectedEmpObj ? `${selectedEmpObj.first_name} ${selectedEmpObj.last_name}` : '—'}
              </p>
              <p><span className="font-medium">Period:</span>{' '}
                {monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth}
              </p>
              <p><span className="font-medium">Layout:</span>{' '}
                {selectedTemplate === 'detailed' ? 'Detailed (with summary & working days)' : 'Summary (compact)'}
              </p>
              <p><span className="font-medium">Columns:</span>{' '}
                {COLUMN_OPTIONS.filter(c => selectedColumns.has(c.key)).map(c => c.label).join(', ') || '—'}
              </p>
              <p><span className="font-medium">Signatures:</span> {includeSignatures ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {/* ── Export button ─────────────────────────────────────────────── */}
          {canExport ? (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold
                 text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors"
            >
              <FileDown className="w-5 h-5" />
              {exporting ? 'Generating PDF…' : 'Export as PDF'}
            </button>
          ) : (
            <div className="w-full px-6 py-4 text-center text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl">
              You do not have permission to export timesheets.
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  )
}