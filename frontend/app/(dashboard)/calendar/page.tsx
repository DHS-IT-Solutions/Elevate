// app/(dashboard)/calendar/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Search, MapPin, Users, ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import TeamCalendarGrid from '@/components/calendar/TeamCalendarGrid'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [CalendarPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [CalendarPage] ${message}`)
}

type PeriodOption = 'next_4_weeks' | 'current_month' | 'next_month' | 'custom'

interface FilterState {
  search: string
  locations: string[]
  roles: string[]
  teams: string[]
  selectedTeamId: string // '' = all (only for admin view)
}

export default function CalendarPage() {
  const [period, setPeriod] = useState<PeriodOption>('next_4_weeks')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    locations: [],
    roles: [],
    teams: [],
    selectedTeamId: ''
  })
  
  const [availableLocations, setAvailableLocations] = useState<string[]>([])
  const [availableRoles, setAvailableRoles] = useState<Array<{id: string, name: string}>>([])
  const [availableTeams, setAvailableTeams] = useState<Array<{id: string, name: string}>>([])
  const [currentUserTeamId, setCurrentUserTeamId] = useState<string | null>(null)
  
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  
  const supabase = createClient()
  
  // ✅ RBAC Permissions
  const { hasPermission: canViewAllTeams } = usePermission(PERMISSIONS.LEAVES.VIEW_ALL)

  useEffect(() => {
    log('DEBUG', 'CalendarPage mounted')
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      // Get current user's team
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: employee } = await supabase
        .from('employees')
        .select('id, team_id, company_id')
        .eq('user_id', user.id)
        .single()

      if (employee) {
        setCurrentUserTeamId(employee.team_id || null)
        log('INFO', 'Current user team ID', { teamId: employee.team_id })

        // Fetch locations (unique work_location from employees - updated field name)
        const { data: employeesWithLocations } = await supabase
          .from('employees')
          .select('work_location')
          .eq('company_id', employee.company_id!)
          .eq('is_active', true)

        const uniqueLocations = [...new Set(
          employeesWithLocations
            ?.map(e => e.work_location)
            .filter(Boolean) as string[]
        )]
        setAvailableLocations(uniqueLocations)

        // Fetch roles
        const { data: roles } = await supabase
          .from('roles')
          .select('id, name')
          .order('name')

        if (roles) setAvailableRoles(roles)

        // Fetch teams based on permissions
        let teamsQuery = supabase
          .from('teams')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        // If user can only view their team, filter to just their team
        if (!canViewAllTeams && employee.team_id) {
          teamsQuery = teamsQuery.eq('id', employee.team_id)
        }

        const { data: teams } = await teamsQuery

        if (teams) setAvailableTeams(teams)
        
        log('INFO', 'Filter options loaded', {
          locations: uniqueLocations.length,
          roles: roles?.length || 0,
          teams: teams?.length || 0
        })
      }
    } catch (err) {
      log('ERROR', 'Failed to fetch initial data', { error: err })
    }
  }

  const getPeriodDates = () => {
    const today = new Date()
    let start: Date
    let end: Date

    switch (period) {
      case 'next_4_weeks':
        start = today
        end = new Date(today)
        end.setDate(end.getDate() + 28)
        break
      
      case 'current_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      
      case 'next_month':
        start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        end = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        break
      
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate)
          end = new Date(customEndDate)
        } else {
          start = today
          end = new Date(today)
          end.setDate(end.getDate() + 28)
        }
        break
      
      default:
        start = today
        end = new Date(today)
        end.setDate(end.getDate() + 28)
    }

    return { start, end }
  }

  const handleLocationToggle = (location: string) => {
    setFilters(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(l => l !== location)
        : [...prev.locations, location]
    }))
  }

  const handleRoleToggle = (roleId: string) => {
    setFilters(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }))
  }


  const clearFilters = () => {
    setFilters({
      search: '',
      locations: [],
      roles: [],
      teams: [],
      selectedTeamId: ''
    })
    log('DEBUG', 'Filters cleared')
  }

  const activeFilterCount =
    filters.locations.length +
    filters.roles.length +
    filters.teams.length +
    (filters.search ? 1 : 0) +
    (filters.selectedTeamId ? 1 : 0)

  const { start, end } = getPeriodDates()

  return (
    <div>
      <PageHeader
        title="Team Calendar"
        subtitle="View team leaves, holidays, and availability"
        action={
          <Link
            href="/leaves"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                       rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </Link>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Period Selector */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodOption)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                         appearance-none cursor-pointer hover:border-gray-300 transition-colors"
            >
              <option value="next_4_weeks">Next 4 weeks</option>
              <option value="current_month">Current Month</option>
              <option value="next_month">Next Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown className="absolute right-3 top-8 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search by name..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                           hover:border-gray-300 focus:border-blue-500 focus:ring-1 
                           focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Location Filter */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Location
            </label>
            <button
              onClick={() => {
                setShowLocationDropdown(!showLocationDropdown)
                setShowRoleDropdown(false)
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-left
                         hover:border-gray-300 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  {filters.locations.length === 0
                    ? 'All Locations'
                    : `${filters.locations.length} selected`}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showLocationDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowLocationDropdown(false)}
                />
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 
                                rounded-lg shadow-lg max-h-60 overflow-auto">
                  {availableLocations.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No locations available
                    </div>
                  ) : (
                    availableLocations.map(location => (
                      <label
                        key={location}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.locations.includes(location)}
                          onChange={() => handleLocationToggle(location)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">{location}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Role Filter */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Role
            </label>
            <button
              onClick={() => {
                setShowRoleDropdown(!showRoleDropdown)
                setShowLocationDropdown(false)
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-left
                         hover:border-gray-300 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  {filters.roles.length === 0
                    ? 'All Roles'
                    : `${filters.roles.length} selected`}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showRoleDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowRoleDropdown(false)}
                />
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 
                                rounded-lg shadow-lg max-h-60 overflow-auto">
                  {availableRoles.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No roles available
                    </div>
                  ) : (
                    availableRoles.map(role => (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.roles.includes(role.id)}
                          onChange={() => handleRoleToggle(role.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm capitalize">{role.name.replace('_', ' ')}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Team Selector (single-select dropdown for admin) */}
        {canViewAllTeams && availableTeams.length > 1 && (
          <div className="mt-3 relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Team Calendar
            </label>
            <div className="relative">
              <select
                value={filters.selectedTeamId}
                onChange={(e) => setFilters(prev => ({ ...prev, selectedTeamId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                           appearance-none cursor-pointer hover:border-gray-300 transition-colors"
              >
                <option value="">All Teams</option>
                {availableTeams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Custom Date Range */}
        {period === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        {/* Active Filters & Clear */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-600">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 
                         font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Legend</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">23</span>
            <span>Annual Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">23</span>
            <span>Sick Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">23</span>
            <span>Work From Home</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold bg-gray-200 text-gray-800 border border-gray-400">23</span>
            <span>Unpaid Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">23</span>
            <span>Pending Approval</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">23</span>
            <span>Weekend</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-6 rounded text-xs font-medium text-gray-500">23</span>
            <span>Available</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <TeamCalendarGrid
        startDate={start}
        endDate={end}
        filters={filters}
        currentUserTeamId={currentUserTeamId}
        canViewAllTeams={canViewAllTeams}
      />
    </div>
  )
}