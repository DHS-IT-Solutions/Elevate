// app/(dashboard)/company/page.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAllEmployees } from '@/lib/hooks/useEmployee'
import EmployeeCard from '@/components/company/EmployeeCard'
import DirectoryFilters from '@/components/company/DirectoryFilters'
import { PageHeader } from '@/components/shared/PageHeader'
import { Users, GitBranch } from 'lucide-react'
import Link from 'next/link'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [CompanyPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [CompanyPage] ${message}`)
}

type Tab = 'directory' | 'orgchart'
type View = 'grid' | 'list'

interface Filters {
  search: string
  region: string
  department: string
  team: string
  status: string
}

export default function CompanyPage() {
  const { employees, loading } = useAllEmployees()
  const [tab, setTab]     = useState<Tab>('directory')
  const [view, setView]   = useState<View>('grid')
  const [filters, setFilters] = useState<Filters>({
    search: '', region: '', department: '', team: '', status: '',
  })

  useEffect(() => {
    if (!loading) {
      log('INFO', `Employee data loaded`, {
        total:    employees.length,
        active:   employees.filter(e => e.employment_status === 'active').length,
        inactive: employees.filter(e => e.employment_status !== 'active').length,
      })

      if (employees.length === 0) {
        log('WARN', 'No employees returned — directory will be empty', {
          hint: 'Check useAllEmployees() hook, RLS policies, or company_id scoping',
        })
      }
    }
  }, [loading, employees])

  // ── Derived data ────────────────────────────────────────────────────────────
  const departments = useMemo(() => {
    const result = [...new Set(
      employees.map(e => e.department).filter(Boolean) as string[]
    )].sort()
    log('DEBUG', `Derived ${result.length} unique department(s)`, { departments: result })
    return result
  }, [employees])

  const teams = useMemo(() => {
    const result = [...new Set(
      employees.map(e => e.team_id).filter(Boolean) as string[]
    )]
    log('DEBUG', `Derived ${result.length} unique team_id(s)`)
    return result
  }, [employees])

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase()
    const result = employees.filter(emp => {
      const name = `${emp.first_name} ${emp.last_name}`.toLowerCase()
      if (q && !name.includes(q)
             && !emp.position?.toLowerCase().includes(q)
             && !emp.email.toLowerCase().includes(q)) return false
      if (filters.region     && emp.region !== filters.region)         return false
      if (filters.department && emp.department !== filters.department) return false
      if (filters.status === 'active'   && emp.employment_status !== 'active') return false
      if (filters.status === 'inactive' && emp.employment_status === 'active') return false
      return true
    })

    const activeFilters = Object.entries(filters)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}="${v}"`)

    if (activeFilters.length > 0) {
      log('DEBUG', `Filter applied — ${result.length}/${employees.length} employee(s) shown`, {
        activeFilters,
      })

      if (result.length === 0 && employees.length > 0) {
        log('WARN', 'Active filters produced zero results', {
          filters,
          totalEmployees: employees.length,
          hint: 'User may have applied conflicting filters',
        })
      }
    }

    return result
  }, [employees, filters])

  const tabs = [
    { id: 'directory', label: 'Directory', icon: Users,     href: null },
    { id: 'orgchart',  label: 'Org Chart', icon: GitBranch, href: '/company/org-chart' },
  ]

  return (
    <div>
      <PageHeader
        title="Company"
        subtitle={`${employees.length} employees across all teams`}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => {
          const Icon     = t.icon
          const isActive = tab === t.id
          const inner = (
            <div
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2
                          transition-colors cursor-pointer ${
                            isActive
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
              onClick={() => {
                log('DEBUG', `Tab changed to "${t.id}"`)
                setTab(t.id as Tab)
              }}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </div>
          )
          return t.href
            ? <Link key={t.id} href={t.href}>{inner}</Link>
            : <div key={t.id}>{inner}</div>
        })}
      </div>

      {/* Directory Tab */}
      {tab === 'directory' && (
        <>
          <DirectoryFilters
            filters={filters}
            onChange={p => {
              log('DEBUG', 'Filter changed', { patch: p })
              setFilters(prev => ({ ...prev, ...p }))
            }}
            view={view}
            onViewChange={v => {
              log('DEBUG', `View changed to "${v}"`)
              setView(v)
            }}
            totalCount={filtered.length}
            departments={departments}
            teams={teams}
          />

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No employees found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} view="grid" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} view="list" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}