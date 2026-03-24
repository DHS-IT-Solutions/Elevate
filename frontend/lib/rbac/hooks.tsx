// ═══════════════════════════════════════════════════════════════════════════
// RBAC REACT HOOKS & COMPONENTS
// Easy-to-use hooks and components for permission checking in React
// ═══════════════════════════════════════════════════════════════════════════

'use client'

import { useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  checkPermission, 
  hasRole, 
  isAdmin, 
  isManager,
  getUserPermissions,
  ROLES,
  PERMISSIONS,
  type Permission,
  type UserRole 
} from './index'

// CUSTOM HOOKS
/**
 * Hook to get current user's roles
 */
export function useUserRoles() {
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRoles() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setRoles([])
          setLoading(false)
          return
        }

        const { data: employee } = await supabase
          .from('employees')
          .select('employee_roles!employee_roles_employee_id_fkey(roles(name))')
          .eq('user_id', user.id)
          .single()

        if (employee) {
          const userRoles = employee.employee_roles
            ?.map((er: any) => er.roles?.name)
            .filter(Boolean) || []
          setRoles(userRoles)
        }
      } catch (error) {
        console.error('Error fetching user roles:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRoles()
  }, [])

  return { roles, loading }
}

/**
 * Hook to check if user has a specific permission
 */
export function usePermission(permission: Permission) {
  const { roles, loading } = useUserRoles()
  const hasPermission = !loading && checkPermission(roles, permission)
  
  return { hasPermission, loading }
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: UserRole) {
  const { roles, loading } = useUserRoles()
  const userHasRole = !loading && hasRole(roles, role)
  
  return { hasRole: userHasRole, loading }
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  const { roles, loading } = useUserRoles()
  const userIsAdmin = !loading && isAdmin(roles)
  
  return { isAdmin: userIsAdmin, loading }
}

/**
 * Hook to check if user is manager
 */
export function useIsManager() {
  const { roles, loading } = useUserRoles()
  const userIsManager = !loading && isManager(roles)
  
  return { isManager: userIsManager, loading }
}

/**
 * Hook to get all user permissions
 */
export function useUserPermissions() {
  const { roles, loading } = useUserRoles()
  const permissions = !loading ? getUserPermissions(roles) : []
  
  return { permissions, loading }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION COMPONENTS
// Declarative components for showing/hiding content based on permissions
// ═══════════════════════════════════════════════════════════════════════════

interface CanProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component that renders children only if user has permission
 * 
 * Usage:
 * <Can permission={PERMISSIONS.TIMESHEETS.APPROVE}>
 *   <button>Approve Timesheet</button>
 * </Can>
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { hasPermission, loading } = usePermission(permission)
  
  if (loading) return null
  return hasPermission ? <>{children}</> : <>{fallback}</>
}

interface HasRoleProps {
  role: UserRole
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component that renders children only if user has role
 * 
 * Usage:
 * <HasRole role={ROLES.ADMIN}>
 *   <AdminPanel />
 * </HasRole>
 */
export function HasRole({ role, children, fallback = null }: HasRoleProps) {
  const { hasRole, loading } = useHasRole(role)
  
  if (loading) return null
  return hasRole ? <>{children}</> : <>{fallback}</>
}

interface AdminOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component that renders children only for admins
 * 
 * Usage:
 * <AdminOnly>
 *   <SettingsPage />
 * </AdminOnly>
 */
export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin, loading } = useIsAdmin()
  
  if (loading) return null
  return isAdmin ? <>{children}</> : <>{fallback}</>
}

interface ManagerOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component that renders children only for managers
 * 
 * Usage:
 * <ManagerOnly>
 *   <ApproveButton />
 * </ManagerOnly>
 */
export function ManagerOnly({ children, fallback = null }: ManagerOnlyProps) {
  const { isManager, loading } = useIsManager()
  
  if (loading) return null
  return isManager ? <>{children}</> : <>{fallback}</>
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface ProtectedRouteProps {
  permission?: Permission
  role?: UserRole
  requireAdmin?: boolean
  requireManager?: boolean
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Component for protecting entire routes/pages
 * 
 * Usage:
 * <ProtectedRoute permission={PERMISSIONS.SETTINGS.UPDATE_COMPANY}>
 *   <CompanySettingsPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  permission,
  role,
  requireAdmin,
  requireManager,
  children,
  fallback = <div className="text-center py-20">
    <p className="text-gray-600">You don't have permission to view this page.</p>
  </div>
}: ProtectedRouteProps) {
  const { roles, loading } = useUserRoles()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Check permission
  if (permission && !checkPermission(roles, permission)) {
    return <>{fallback}</>
  }

  // Check role
  if (role && !hasRole(roles, role)) {
    return <>{fallback}</>
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin(roles)) {
    return <>{fallback}</>
  }

  // Check manager requirement
  if (requireManager && !isManager(roles)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { ROLES, PERMISSIONS }
export type { Permission, UserRole }