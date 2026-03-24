// app/(dashboard)/settings/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute, usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import CompanySettings from '@/components/settings/CompanySettings'
import HolidayManagement from '@/components/settings/HolidayManagement'
import LeavePolicyManagement from '@/components/settings/LeavePolicyManagement'
import ApproverAssignment from '@/components/settings/ApproverAssignment'  // ← ADD THIS
import RoleManagement from '@/components/settings/RoleManagement'
import TeamManagement from '@/components/settings/TeamManagement'
import { Building2, Calendar, FileText, Shield, Users, UserPlus } from 'lucide-react'
import Link from 'next/link'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [SettingsPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [SettingsPage] ${message}`)
}

type Tab = 'company' | 'teams' | 'roles' | 'holidays' | 'leave-policies' | 'approvers'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  const { hasPermission: canViewCompany } = usePermission(PERMISSIONS.SETTINGS.VIEW_COMPANY)
  const { hasPermission: canManageTeams } = usePermission(PERMISSIONS.TEAMS.VIEW_ALL)
  const { hasPermission: canManageRoles } = usePermission(PERMISSIONS.ROLES.VIEW)
  const { hasPermission: canManageHolidays } = usePermission(PERMISSIONS.SETTINGS.MANAGE_HOLIDAYS)
  const { hasPermission: canManagePolicies } = usePermission(PERMISSIONS.LEAVES.MANAGE_POLICIES)
  const { hasPermission: canManageApprovers } = usePermission(PERMISSIONS.APPROVERS.ASSIGN_APPROVER)
  const { hasPermission: canInvite } = usePermission(PERMISSIONS.EMPLOYEES.INVITE)


  const allTabs: { id: Tab; label: string; icon: any; visible: boolean }[] = [
    { id: 'company', label: 'Company', icon: Building2, visible: canViewCompany },
    { id: 'teams', label: 'Teams', icon: Users, visible: canManageTeams },
    { id: 'roles', label: 'Roles', icon: Shield, visible: canManageRoles },
    { id: 'holidays', label: 'Holidays', icon: Calendar, visible: canManageHolidays },
    { id: 'leave-policies', label: 'Leave Policies', icon: FileText, visible: canManagePolicies },
    { id: 'approvers', label: 'Approvers', icon: UserPlus, visible: canManageApprovers },
  ]

  const tabs = allTabs.filter(t => t.visible)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your company configuration"
        />
        {canInvite && (
          <Link
            href="/settings/invite"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
               rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Employee
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id !== tab) {
                log('DEBUG', `Settings tab changed to "${t.id}"`)
                setTab(t.id)
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 
                        whitespace-nowrap transition-colors ${tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'company' && <CompanySettings />}
      {tab === 'teams' && <TeamManagement />}
      {tab === 'roles' && <RoleManagement />}
      {tab === 'holidays' && <HolidayManagement />}
      {tab === 'leave-policies' && <LeavePolicyManagement />}
      {tab === 'approvers' && <ApproverAssignment />}
    </div>
  )
}
