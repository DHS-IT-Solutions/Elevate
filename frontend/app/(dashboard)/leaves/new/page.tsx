// app/(dashboard)/leaves/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LeaveRequestForm from '@/components/leaves/LeaveRequestForm'
import { PageHeader } from '@/components/shared/PageHeader'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ProtectedRoute, PERMISSIONS } from '@/lib/rbac/hooks'


// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [NewLeavePage] ${message}`, data)
    : fn(`[${ts}] [${level}] [NewLeavePage] ${message}`)
}

export default function NewLeavePage() {
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'NewLeavePage mounted — resolving employee ID')

    const fetch = async () => {
      try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
          log('WARN', 'supabase.auth.getUser() error', {
            message: authError.message,
            status: authError.status,
          })
          setResolveError('Authentication error — please refresh and try again')
          return
        }

        if (!user) {
          log('WARN', 'No authenticated user — cannot load leave request form')
          setResolveError('You must be logged in to request leave')
          return
        }

        log('DEBUG', 'Auth user resolved', { userId: user.id })

        // ── Employee ──────────────────────────────────────────────────────────
        const { data: emp, error: empError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (empError) {
          if (empError.code === 'PGRST116') {
            log('WARN', 'No employee record found for user — form cannot render', {
              userId: user.id,
              hint: 'User exists in auth but has no employees row',
            })
            setResolveError('Your employee profile could not be found. Please contact your administrator.')
          } else {
            log('ERROR', 'Failed to fetch employee record', {
              userId: user.id,
              code: empError.code,
              message: empError.message,
            })
            setResolveError('Failed to load your employee profile. Please try again.')
          }
          return
        }

        log('INFO', 'Employee ID resolved — rendering leave request form', {
          employeeId: emp.id,
        })

        setEmployeeId(emp.id)

      } catch (err) {
        log('ERROR', 'Unexpected exception resolving employee ID', {
          error: err instanceof Error ? err.message : String(err),
        })
        setResolveError('An unexpected error occurred. Please refresh the page.')
      }
    }

    fetch()
  }, [])

  // ── Error state — replaces the infinite spinner ───────────────────────────
  if (resolveError) {
    return (
      <div className="max-w-2xl">
        <Link
          href="/leaves"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leaves
        </Link>
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {resolveError}
        </div>
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!employeeId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <ProtectedRoute permission={PERMISSIONS.LEAVES.REQUEST}>
      <div className="max-w-2xl">
        <Link
          href="/leaves"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leaves
        </Link>

        <PageHeader
          title="Request Time Off"
          subtitle="Submit a new leave request for approval"
        />

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <LeaveRequestForm employeeId={employeeId} />
        </div>
      </div>
    </ProtectedRoute>
  )
}