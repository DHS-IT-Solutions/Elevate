// components/layout/Sidebar.tsx — UPDATED FOR PHASE 5
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Users, FileText,
  Clock, Settings, Megaphone, GitBranch, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Company', href: '/company', icon: Users },
  { name: 'Org Chart', href: '/company/org-chart', icon: GitBranch },
  { name: 'Announcements', href: '/announcements', icon: Megaphone },
  { name: 'Timesheets', href: '/timesheets', icon: Clock },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { hasPermission: canViewSettings } = usePermission(PERMISSIONS.SETTINGS.VIEW_COMPANY)

  return (
    <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-200
                     ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}>
      <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
          {!collapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-blue-600 tracking-tight">
              DHS Elevate
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-blue-600 mx-auto">
              D
            </Link>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
                       hover:bg-gray-100 transition-colors ml-auto"
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {navigation.filter(item => {
            if (item.href === '/settings') return canViewSettings
            return true
          }).map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href
              || (item.href !== '/dashboard' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                            font-medium transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom brand */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">DHS IT Solutions</p>
          </div>
        )}
      </div>
    </div>
  )
}
