// components/settings/ApproverAssignment.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/shared/Avatar'
import {
  Users, User, ChevronDown, ChevronUp, AlertCircle,
  UserPlus, Mail, Briefcase, Shield, CheckCircle2, XCircle
} from 'lucide-react'

/**
 * APPROVER ASSIGNMENT - Team Directory with Approver Management
 * 
 * Features:
 * 1. View employees grouped by team
 * 2. Show approver/manager for each employee
 * 3. Assign approver if not assigned
 * 4. See full reporting hierarchy
 * 5. Team statistics and insights
 * 6. Quick filters and search
 */

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  position: string | null
  profile_picture_url: string | null
  employment_status: string | null
  manager_id: string | null
  manager?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  team?: {
    id: string
    name: string
  }
  roles?: Array<{ name: string }>
}

interface TeamGroup {
  team_id: string | null
  team_name: string
  employees: Employee[]
}

export default function ApproverAssignment() {
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'with_approver' | 'without_approver'>('all')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedManager, setSelectedManager] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { hasPermission: canAssignApprover } = usePermission(PERMISSIONS.APPROVERS.ASSIGN_APPROVER)
  const { hasPermission: canChangeApprover } = usePermission(PERMISSIONS.APPROVERS.CHANGE_APPROVER)

  useEffect(() => {
    fetchTeamData()
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  // FETCH DATA
  // ══════════════════════════════════════════════════════════════════════════

  const fetchTeamData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all active employees with their teams, managers, and roles
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          email,
          position,
          profile_picture_url,
          employment_status,
          manager_id,
          team:teams(id, name),
          manager:employees(id, first_name, last_name, email),
          employee_roles!employee_roles_employee_id_fkey(roles(name))
        `)
        .eq('is_active', true)
        .order('first_name')

      if (empError) {
        console.error('[TeamsPage] Error fetching employees:', empError)
        throw empError
      }

      if (!employees) {
        setTeamGroups([])
        setAllEmployees([])
        setLoading(false)
        return
      }

      // Process employees
      const processedEmployees: Employee[] = employees.map((emp: any) => ({
        ...emp,
        team: emp.team || null,
        manager: emp.manager || null,
        roles: emp.employee_roles?.map((er: any) => er.roles).filter(Boolean) || []
      }))

      setAllEmployees(processedEmployees)

      // Group by team
      const grouped = processedEmployees.reduce((acc: Record<string, Employee[]>, emp) => {
        const teamId = emp.team?.id || 'no_team'
        if (!acc[teamId]) {
          acc[teamId] = []
        }
        acc[teamId].push(emp)
        return acc
      }, {})

      // Convert to array of TeamGroup
      const teamGroupsArray: TeamGroup[] = Object.entries(grouped).map(([teamId, emps]) => ({
        team_id: teamId === 'no_team' ? null : teamId,
        team_name: teamId === 'no_team' ? 'Unassigned' : emps[0]?.team?.name || 'Unknown',
        employees: emps
      }))

      // Sort: teams with names first, then unassigned
      teamGroupsArray.sort((a, b) => {
        if (!a.team_id) return 1
        if (!b.team_id) return -1
        return a.team_name.localeCompare(b.team_name)
      })

      setTeamGroups(teamGroupsArray)

      // Auto-expand all teams initially
      setExpandedTeams(new Set(teamGroupsArray.map(tg => tg.team_id || 'no_team')))

    } catch (err: any) {
      console.error('[TeamsPage] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ASSIGN APPROVER
  // ══════════════════════════════════════════════════════════════════════════

  const handleAssignApprover = (employee: Employee) => {
    setSelectedEmployee(employee)
    setSelectedManager(employee.manager_id || '')
    setShowAssignModal(true)
  }

  const submitApproverAssignment = async () => {
    if (!selectedEmployee || !selectedManager) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('employees')
        .update({ manager_id: selectedManager })
        .eq('id', selectedEmployee.id)

      if (error) throw error

      console.log('[TeamsPage] Approver assigned successfully')

      // Refresh data
      await fetchTeamData()
      setShowAssignModal(false)
      setSelectedEmployee(null)
      setSelectedManager('')

    } catch (err: any) {
      console.error('[TeamsPage] Error assigning approver:', err)
      alert(`Failed to assign approver: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FILTERING & SEARCH
  // ══════════════════════════════════════════════════════════════════════════

  const getFilteredTeams = () => {
    let filtered = teamGroups

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.map(tg => ({
        ...tg,
        employees: tg.employees.filter(emp =>
          `${emp.first_name} ${emp.last_name} ${emp.email} ${emp.position}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
      })).filter(tg => tg.employees.length > 0)
    }

    // Apply approver filter
    if (filterStatus === 'with_approver') {
      filtered = filtered.map(tg => ({
        ...tg,
        employees: tg.employees.filter(emp => emp.manager_id !== null)
      })).filter(tg => tg.employees.length > 0)
    } else if (filterStatus === 'without_approver') {
      filtered = filtered.map(tg => ({
        ...tg,
        employees: tg.employees.filter(emp => emp.manager_id === null)
      })).filter(tg => tg.employees.length > 0)
    }

    return filtered
  }

  const toggleTeam = (teamId: string | null) => {
    const id = teamId || 'no_team'
    const newExpanded = new Set(expandedTeams)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedTeams(newExpanded)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════════════════════

  const getTotalEmployees = () => allEmployees.length
  const getEmployeesWithApprover = () => allEmployees.filter(e => e.manager_id).length
  const getEmployeesWithoutApprover = () => allEmployees.filter(e => !e.manager_id).length
  const getTotalTeams = () => teamGroups.filter(tg => tg.team_id).length

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p>Loading team data...</p>
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

  const filteredTeams = getFilteredTeams()

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Employee Directory & Approvers</h2>
        <p className="text-sm text-gray-500 mt-1">View team members and manage their approvers</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{getTotalEmployees()}</p>
              <p className="text-sm text-gray-500">Total Employees</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{getTotalTeams()}</p>
              <p className="text-sm text-gray-500">Active Teams</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{getEmployeesWithApprover()}</p>
              <p className="text-sm text-gray-500">With Approver</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{getEmployeesWithoutApprover()}</p>
              <p className="text-sm text-gray-500">Without Approver</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All ({getTotalEmployees()})
            </button>
            <button
              onClick={() => setFilterStatus('with_approver')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'with_approver'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              With Approver ({getEmployeesWithApprover()})
            </button>
            <button
              onClick={() => setFilterStatus('without_approver')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'without_approver'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Without Approver ({getEmployeesWithoutApprover()})
            </button>
          </div>
        </div>
      </div>

      {/* Team Groups */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900">No teams found</p>
          <p className="text-sm text-gray-500 mt-1">
            {searchTerm ? 'Try a different search term' : 'No employees match the current filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTeams.map(teamGroup => {
            const teamId = teamGroup.team_id || 'no_team'
            const isExpanded = expandedTeams.has(teamId)
            const employeesWithoutApprover = teamGroup.employees.filter(e => !e.manager_id).length

            return (
              <div key={teamId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Team Header */}
                <button
                  onClick={() => toggleTeam(teamGroup.team_id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${teamGroup.team_id ? 'bg-blue-50' : 'bg-gray-100'
                      }`}>
                      <Users className={`w-5 h-5 ${teamGroup.team_id ? 'text-blue-600' : 'text-gray-500'
                        }`} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{teamGroup.team_name}</h3>
                      <p className="text-sm text-gray-500">
                        {teamGroup.employees.length} member{teamGroup.employees.length !== 1 ? 's' : ''}
                        {employeesWithoutApprover > 0 && (
                          <span className="text-red-600 ml-2">
                            • {employeesWithoutApprover} without approver
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Team Members */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="divide-y divide-gray-100">
                      {teamGroup.employees.map(employee => (
                        <div
                          key={employee.id}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            {/* Employee Info */}
                            <div className="flex items-center gap-3 flex-1">
                              <Avatar
                                name={`${employee.first_name} ${employee.last_name}`}
                                imageUrl={employee.profile_picture_url}
                                size="md"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">
                                    {employee.first_name} {employee.last_name}
                                  </p>
                                  {employee.roles && employee.roles.length > 0 && (
                                    <div className="flex gap-1">
                                      {employee.roles.map((role, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium capitalize"
                                        >
                                          {role.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {employee.email}
                                  </span>
                                  {employee.position && (
                                    <span className="text-sm text-gray-500 flex items-center gap-1">
                                      <Briefcase className="w-3 h-3" />
                                      {employee.position}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Approver Info & Action */}
                            <div className="flex items-center gap-3">
                              {employee.manager ? (
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 mb-1">Approver</p>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-green-600" />
                                    <p className="text-sm font-medium text-gray-900">
                                      {employee.manager.first_name} {employee.manager.last_name}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <p className="text-xs text-red-600 mb-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    No Approver
                                  </p>
                                </div>
                              )}
                              {(employee.manager ? canChangeApprover : canAssignApprover) && (
                                <button
                                  onClick={() => handleAssignApprover(employee)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${employee.manager
                                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      : 'bg-red-600 text-white hover:bg-red-700'
                                    }`}
                                >
                                  {employee.manager ? 'Change' : 'Assign'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Assign Approver Modal */}
      {showAssignModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Approver
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Employee</p>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Avatar
                  name={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                  imageUrl={selectedEmployee.profile_picture_url}
                  size="sm"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{selectedEmployee.position}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Approver/Manager *
              </label>
              <select
                value={selectedManager}
                onChange={e => setSelectedManager(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">Choose an approver...</option>
                {allEmployees
                  .filter(e => e.id !== selectedEmployee.id) // Can't be their own approver
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.position || 'No position'}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedEmployee(null)
                  setSelectedManager('')
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitApproverAssignment}
                disabled={!selectedManager || saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Assigning...' : 'Assign Approver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}