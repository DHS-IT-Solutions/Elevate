// components/settings/RoleManagement.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, UserPlus } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [RoleManagement] ${message}`, data)
    : fn(`[${ts}] [${level}] [RoleManagement] ${message}`)
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  position: string | null
  profile_picture_url: string | null
}

interface Role {
  id: string
  name: string
  description: string | null
}

interface EmployeeRole {
  employee: Employee
  roles: Role[]
}

export default function RoleManagement() {
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [actionError, setActionError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'RoleManagement mounted — fetching data')
    fetchData()
  }, [])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    log('DEBUG', 'fetchData() called — loading roles, employees, and assignments')
    setActionError(null)

    try {
      // ── Step 1: roles ───────────────────────────────────────────────────────
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (rolesError) {
        log('ERROR', 'Failed to fetch roles', {
          code: rolesError.code,
          message: rolesError.message,
          details: rolesError.details,
        })
        setActionError(`Failed to load roles: ${rolesError.message}`)
        setLoading(false)
        return
      }

      log('INFO', `Loaded ${rolesData?.length ?? 0} role(s)`, {
        roles: rolesData?.map(r => r.name),
      })
      setRoles((rolesData as Role[]) ?? [])

      // ── Step 2: active employees ────────────────────────────────────────────
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, position, profile_picture_url')
        .eq('is_active', true)
        .order('first_name')

      if (employeesError) {
        log('ERROR', 'Failed to fetch employees', {
          code: employeesError.code,
          message: employeesError.message,
          details: employeesError.details,
        })
        setActionError(`Failed to load employees: ${employeesError.message}`)
        setLoading(false)
        return
      }

      log('INFO', `Loaded ${employeesData?.length ?? 0} active employee(s)`)
      setEmployees((employeesData as Employee[]) ?? [])

      // ── Step 3: role assignments ────────────────────────────────────────────
      log('DEBUG', 'Fetching employee_roles assignments with joined employee and role data')
      const { data: assignments, error: assignmentsError } = await supabase
  .from('employee_roles')
  .select(`
    employee_id,
    employees!employee_roles_employee_id_fkey(id, first_name, last_name, email, position, profile_picture_url),
    roles(id, name, description)
  `)

      if (assignmentsError) {
        log('ERROR', 'Failed to fetch role assignments', {
          code: assignmentsError.code,
          message: assignmentsError.message,
          details: assignmentsError.details,
          hint: assignmentsError.hint,
        })
        setActionError(`Failed to load role assignments: ${assignmentsError.message}`)
        setLoading(false)
        return
      }

      log('DEBUG', `Received ${assignments?.length ?? 0} raw assignment row(s) — grouping by employee`)

      // ── Step 4: group assignments by employee ───────────────────────────────
      const grouped = (assignments ?? []).reduce((acc: any, curr: any) => {
        const empId = curr.employee_id

        if (!curr.employees || !curr.roles) {
          log('WARN', 'Assignment row is missing joined employee or role data — skipping', {
            employee_id: empId,
            hasEmployee: !!curr.employees,
            hasRole: !!curr.roles,
          })
          return acc
        }

        if (!acc[empId]) {
          acc[empId] = { employee: curr.employees, roles: [] }
        }
        acc[empId].roles.push(curr.roles)
        return acc
      }, {})

      const grouped_values: EmployeeRole[] = Object.values(grouped)

      log('INFO', `Role assignments grouped into ${grouped_values.length} employee record(s)`, {
        summary: grouped_values.map(er => ({
          employee: `${er.employee.first_name} ${er.employee.last_name}`,
          roles: er.roles.map((r: Role) => r.name),
        })),
      })

      setEmployeeRoles(grouped_values)

    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchData()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while loading data')
    } finally {
      setLoading(false)
    }
  }

  // ── Assign Role ─────────────────────────────────────────────────────────────
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError(null)

    if (!selectedEmployee || !selectedRole) {
      log('WARN', 'handleAssignRole() called with missing selection', {
        selectedEmployee: selectedEmployee || '(none)',
        selectedRole: selectedRole || '(none)',
      })
      return
    }

    const targetEmployee = employees.find(emp => emp.id === selectedEmployee)
    const targetRole = roles.find(r => r.id === selectedRole)

    log('INFO', 'Assigning role to employee', {
      employeeId: selectedEmployee,
      employeeName: targetEmployee ? `${targetEmployee.first_name} ${targetEmployee.last_name}` : 'unknown',
      roleId: selectedRole,
      roleName: targetRole?.name ?? 'unknown',
    })

    try {
      // ── Resolve the assigning admin's employee id ───────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        log('WARN', 'supabase.auth.getUser() error during role assignment', {
          message: authError.message,
          status: authError.status,
        })
        setActionError('Authentication error — please refresh and try again')
        return
      }

      if (!user) {
        log('WARN', 'No authenticated user — cannot assign role')
        setActionError('You must be logged in to assign roles')
        return
      }

      log('DEBUG', 'Resolving admin employee record for assigned_by field', { userId: user.id })

      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (empError) {
        if (empError.code === 'PGRST116') {
          log('WARN', 'No employee record found for current admin user', {
            userId: user.id,
            hint: 'assigned_by will be null — role will still be assigned',
          })
        } else {
          log('ERROR', 'Failed to resolve admin employee record', {
            userId: user.id,
            code: empError.code,
            message: empError.message,
          })
        }
        // Non-fatal — proceed without assigned_by rather than blocking the action
      } else {
        log('DEBUG', 'Admin employee resolved', { assignedById: emp?.id })
      }

      // ── Check for duplicate assignment ──────────────────────────────────────
      const alreadyAssigned = employeeRoles
        .find(er => er.employee.id === selectedEmployee)
        ?.roles.some(r => r.id === selectedRole)

      if (alreadyAssigned) {
        log('WARN', 'Duplicate role assignment blocked', {
          employeeId: selectedEmployee,
          roleId: selectedRole,
          roleName: targetRole?.name,
        })
        setActionError(`${targetEmployee?.first_name ?? 'This employee'} already has the "${targetRole?.name}" role`)
        return
      }

      // ── Insert assignment ───────────────────────────────────────────────────
      log('DEBUG', 'Inserting employee_roles record')
      const { error: insertError } = await supabase
        .from('employee_roles')
        .insert({
          employee_id: selectedEmployee,
          role_id: selectedRole,
          assigned_by: emp?.id ?? null,
        })

      if (insertError) {
        // Postgres unique constraint violation
        if (insertError.code === '23505') {
          log('WARN', 'Unique constraint violation — role already assigned at DB level', {
            employeeId: selectedEmployee,
            roleId: selectedRole,
            code: insertError.code,
          })
          setActionError(`This role is already assigned to this employee`)
        } else {
          log('ERROR', 'Failed to insert role assignment', {
            employeeId: selectedEmployee,
            roleId: selectedRole,
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
          })
          setActionError(`Failed to assign role: ${insertError.message}`)
        }
        return
      }

      log('INFO', 'Role assigned successfully', {
        employeeId: selectedEmployee,
        employeeName: targetEmployee ? `${targetEmployee.first_name} ${targetEmployee.last_name}` : 'unknown',
        roleId: selectedRole,
        roleName: targetRole?.name,
        assignedById: emp?.id ?? 'unknown',
      })

      log('DEBUG', 'Refreshing data after role assignment')
      await fetchData()
      setShowModal(false)
      setSelectedEmployee('')
      setSelectedRole('')

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleAssignRole()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while assigning the role')
    }
  }

  // ── Remove Role ─────────────────────────────────────────────────────────────
  const handleRemoveRole = async (employeeId: string, roleId: string) => {
    const targetEmployee = employeeRoles.find(er => er.employee.id === employeeId)?.employee
    const targetRole = roles.find(r => r.id === roleId)

    log('DEBUG', 'Remove role requested', {
      employeeId,
      employeeName: targetEmployee ? `${targetEmployee.first_name} ${targetEmployee.last_name}` : 'unknown',
      roleId,
      roleName: targetRole?.name ?? 'unknown',
    })

    if (!confirm('Remove this role assignment?')) {
      log('DEBUG', 'Role removal cancelled by user', { employeeId, roleId })
      return
    }

    log('INFO', 'Removing role from employee', {
      employeeId,
      employeeName: targetEmployee ? `${targetEmployee.first_name} ${targetEmployee.last_name}` : 'unknown',
      roleId,
      roleName: targetRole?.name,
    })

    setActionError(null)

    try {
      const { error } = await supabase
        .from('employee_roles')
        .delete()
        .eq('employee_id', employeeId)
        .eq('role_id', roleId)

      if (error) {
        log('ERROR', 'Failed to remove role assignment', {
          employeeId,
          roleId,
          code: error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to remove role: ${error.message}`)
        return
      }

      log('INFO', 'Role removed successfully', {
        employeeId,
        employeeName: targetEmployee ? `${targetEmployee.first_name} ${targetEmployee.last_name}` : 'unknown',
        roleId,
        roleName: targetRole?.name,
      })

      log('DEBUG', 'Refreshing data after role removal')
      await fetchData()

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleRemoveRole()', {
        employeeId,
        roleId,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while removing the role')
    }
  }

  if (loading) return <div className="text-center py-12">Loading roles...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-500 mt-1">Assign roles to employees</p>
        </div>
        <button
          onClick={() => {
            log('DEBUG', 'Assign Role button clicked — opening modal')
            setActionError(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                     rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" />
          Assign Role
        </button>
      </div>

      {/* Page-level error banner */}
      {actionError && !showModal && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {actionError}
        </div>
      )}

      {/* Roles Legend */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Available Roles</p>
        <div className="grid grid-cols-3 gap-4">
          {roles.map(role => (
            <div key={role.id} className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">{role.name}</p>
                <p className="text-xs text-gray-500">{role.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employee Role Assignments */}
      {employeeRoles.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900">No role assignments yet</p>
          <p className="text-sm text-gray-500 mt-1">Assign roles to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employeeRoles.map(({ employee, roles: empRoles }) => {
            const fullName = `${employee.first_name} ${employee.last_name}`
            return (
              <div
                key={employee.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={fullName}
                    imageUrl={employee.profile_picture_url}
                    size="md"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{fullName}</p>
                    <p className="text-sm text-gray-500">{employee.position ?? employee.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {empRoles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => handleRemoveRole(employee.id, role.id)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 
                                 text-blue-700 rounded-lg text-sm font-medium hover:bg-red-50 
                                 hover:text-red-700 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span className="capitalize">{role.name}</span>
                      <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assign Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Role</h3>

            {/* Modal-level error banner */}
            {actionError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAssignRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee *
                </label>
                <select
                  value={selectedEmployee}
                  onChange={e => {
                    const emp = employees.find(em => em.id === e.target.value)
                    log('DEBUG', 'Employee selection changed', {
                      employeeId: e.target.value || '(cleared)',
                      name: emp ? `${emp.first_name} ${emp.last_name}` : '(none)',
                    })
                    setSelectedEmployee(e.target.value)
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select an employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={selectedRole}
                  onChange={e => {
                    const role = roles.find(r => r.id === e.target.value)
                    log('DEBUG', 'Role selection changed', {
                      roleId: e.target.value || '(cleared)',
                      roleName: role?.name ?? '(none)',
                    })
                    setSelectedRole(e.target.value)
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select a role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    log('DEBUG', 'Assign Role modal cancelled by user')
                    setShowModal(false)
                    setSelectedEmployee('')
                    setSelectedRole('')
                    setActionError(null)
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border 
                             border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 
                             rounded-lg hover:bg-blue-700"
                >
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}