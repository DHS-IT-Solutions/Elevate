// components/layout/Header.tsx  — REPLACE EXISTING FILE
'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useEmployee } from '@/lib/hooks/useEmployee'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import Link from 'next/link'
import { Bell, LogOut, User, Settings, Menu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [Header] ${message}`, data)
    : fn(`[${ts}] [${level}] [Header] ${message}`)
}

export default function Header() {
  const { user, signOut } = useAuth()
  const { employee, error: employeeError } = useEmployee()
  const router = useRouter()
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const { hasPermission: canViewSettings } = usePermission(PERMISSIONS.SETTINGS.VIEW_COMPANY)

  const fullName = employee
    ? `${employee.first_name} ${employee.last_name}`
    : user?.email ?? ''

  // ── Warn if employee failed to load but user is authenticated ───────────────
  useEffect(() => {
    if (user && !employee && employeeError) {
      log('WARN', 'Authenticated user has no employee record — header will show email fallback', {
        userId: user.id,
        email: user.email,
        employeeError,
        hint: 'Employee row may be missing or user_id foreign key is not linked',
      })
    }
  }, [user, employee, employeeError])

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        if (dropOpen) {
          log('DEBUG', 'Dropdown closed by outside click')
          setDropOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    log('INFO', 'Sign out initiated', { userId: user?.id, email: user?.email })
    try {
      await signOut()
      log('INFO', 'Sign out successful — redirecting to /login')
      router.push('/login')
      router.refresh()
    } catch (err) {
      log('ERROR', 'Unexpected exception during sign out', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left — breadcrumb space */}
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm text-gray-500 hidden sm:block">
            DHS IT Solutions Ltd
          </p>
        </div>

        {/* Right — notifications + user */}
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => {
                const next = !dropOpen
                log('DEBUG', `User dropdown ${next ? 'opened' : 'closed'}`, {
                  userId: user?.id,
                  employeeId: employee?.id ?? 'none',
                })
                setDropOpen(next)
              }}
              className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg 
                         hover:bg-gray-100 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">{fullName}</p>
                <p className="text-xs text-gray-500">{employee?.position ?? user?.email}</p>
              </div>
              <Avatar
                name={fullName}
                imageUrl={employee?.profile_picture_url}
                size="sm"
              />
            </button>

            {/* Dropdown */}
            {dropOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border 
                              border-gray-200 rounded-xl shadow-lg py-1 z-50">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>

                {employee && (
                  <Link
                    href={`/profile/${employee.id}`}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 
                               hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      log('DEBUG', 'Navigating to profile', { employeeId: employee.id })
                      setDropOpen(false)
                    }}
                  >
                    <User className="w-4 h-4 text-gray-400" /> My Profile
                  </Link>
                )}

                {!employee && (
                  // Profile link is hidden when employee record is missing —
                  // log once so it's clear why the link is absent
                  // (effect above already logged the warning, no need to repeat here)
                  null
                )}

                {canViewSettings && (
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 
               hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      log('DEBUG', 'Navigating to settings')
                      setDropOpen(false)
                    }}
                  >
                    <Settings className="w-4 h-4 text-gray-400" /> Settings
                  </Link>
                )}

                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 
                               hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}