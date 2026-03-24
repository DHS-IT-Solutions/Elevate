// lib/hooks/useLeaves.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LeaveWithEmployee, LeaveBalance } from '@/types/leave'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined ? fn(`[${ts}] [${level}] [useLeaves] ${message}`, data) : fn(`[${ts}] [${level}] [useLeaves] ${message}`)
}

// ── Shared helper: resolve current user → employee id ─────────────────────────
async function resolveEmployeeId(
  supabase: ReturnType<typeof createClient>,
  context: string
): Promise<{ employeeId: string; teamId?: string | null } | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    log('WARN', `[${context}] supabase.auth.getUser() error`, {
      message: authError.message,
      status: authError.status,
    })
    return null
  }
  if (!user) {
    log('WARN', `[${context}] No authenticated user`)
    return null
  }

  log('DEBUG', `[${context}] Authenticated as userId=${user.id}`)

  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, team_id')
    .eq('user_id', user.id)
    .single()

  if (empError) {
    log('ERROR', `[${context}] Failed to resolve employee for userId=${user.id}`, {
      code: empError.code,
      message: empError.message,
    })
    return null
  }
  if (!emp) {
    log('WARN', `[${context}] No employee row found for userId=${user.id}`)
    return null
  }

  log('DEBUG', `[${context}] Resolved employeeId=${emp.id}, teamId=${emp.team_id ?? 'none'}`)
  return { employeeId: emp.id, teamId: emp.team_id }
}

// ── useMyLeaves ───────────────────────────────────────────────────────────────
export function useMyLeaves() {
  const [leaves, setLeaves] = useState<LeaveWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'useMyLeaves mounted')

    const fetch = async () => {
      try {
        const resolved = await resolveEmployeeId(supabase, 'useMyLeaves')
        if (!resolved) { setLoading(false); return }

        log('DEBUG', `useMyLeaves — querying leaves for employeeId=${resolved.employeeId}`)
        const { data, error } = await supabase
          .from('leaves')
          .select(`
            *,
            employee:employees!leaves_employee_id_fkey(id, first_name, last_name, position, profile_picture_url, email),
            approver:employees!leaves_approver_id_fkey(id, first_name, last_name)
          `)
          .eq('employee_id', resolved.employeeId)
          .order('created_at', { ascending: false })

        if (error) {
          log('ERROR', 'useMyLeaves — query failed', {
            code: error.code,
            message: error.message,
            details: error.details,
          })
          setLeaves([])
        } else {
          log('INFO', `useMyLeaves — loaded ${data?.length ?? 0} leave(s)`)
          setLeaves((data as any) ?? [])
        }
      } catch (err) {
        log('ERROR', 'useMyLeaves — unexpected exception', err)
        setLeaves([])
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { leaves, loading, refetch: () => { log('DEBUG', 'useMyLeaves — refetch triggered'); setLoading(true) } }
}

// ── useTeamLeaves ─────────────────────────────────────────────────────────────
export function useTeamLeaves() {
  const [leaves, setLeaves] = useState<LeaveWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'useTeamLeaves mounted')

    const fetch = async () => {
      try {
        const resolved = await resolveEmployeeId(supabase, 'useTeamLeaves')
        if (!resolved) { setLoading(false); return }

        if (!resolved.teamId) {
          log('WARN', `useTeamLeaves — employeeId=${resolved.employeeId} has no team_id assigned — cannot load team leaves`)
          setLoading(false)
          return
        }

        log('DEBUG', `useTeamLeaves — fetching team members for teamId=${resolved.teamId}`)
        const { data: teamMembers, error: teamError } = await supabase
          .from('employees')
          .select('id')
          .eq('team_id', resolved.teamId)

        if (teamError) {
          log('ERROR', 'useTeamLeaves — failed to fetch team members', {
            code: teamError.code,
            message: teamError.message,
          })
          setLoading(false)
          return
        }

        const memberIds = teamMembers?.map(m => m.id) ?? []
        log('DEBUG', `useTeamLeaves — found ${memberIds.length} team member(s)`, { memberIds })

        if (memberIds.length === 0) {
          log('WARN', `useTeamLeaves — team has no members, skipping leaves query`)
          setLeaves([])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('leaves')
          .select(`
            *,
            employee:employees!leaves_employee_id_fkey(id, first_name, last_name, position, profile_picture_url, email),
            approver:employees!leaves_approver_id_fkey(id, first_name, last_name)
          `)
          .in('employee_id', memberIds)
          .order('start_date', { ascending: false })

        if (error) {
          log('ERROR', 'useTeamLeaves — leaves query failed', {
            code: error.code,
            message: error.message,
            details: error.details,
          })
          setLeaves([])
        } else {
          log('INFO', `useTeamLeaves — loaded ${data?.length ?? 0} team leave(s)`)
          setLeaves((data as any) ?? [])
        }
      } catch (err) {
        log('ERROR', 'useTeamLeaves — unexpected exception', err)
        setLeaves([])
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { leaves, loading }
}

// ── usePendingApprovals ───────────────────────────────────────────────────────
export function usePendingApprovals() {
  const [leaves, setLeaves] = useState<LeaveWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'usePendingApprovals mounted')

    const fetch = async () => {
      try {
        const resolved = await resolveEmployeeId(supabase, 'usePendingApprovals')
        if (!resolved) { setLoading(false); return }

        log('DEBUG', `usePendingApprovals — querying pending leaves where approver_id=${resolved.employeeId}`)
        const { data, error } = await supabase
          .from('leaves')
          .select(`
            *,
            employee:employees!leaves_employee_id_fkey(id, first_name, last_name, position, profile_picture_url, email),
            approver:employees!leaves_approver_id_fkey(id, first_name, last_name)
          `)
          .eq('status', 'pending')
          .eq('approver_id', resolved.employeeId)
          .order('created_at', { ascending: false })

        if (error) {
          log('ERROR', 'usePendingApprovals — query failed', {
            code: error.code,
            message: error.message,
            details: error.details,
          })
          setLeaves([])
        } else {
          log('INFO', `usePendingApprovals — loaded ${data?.length ?? 0} pending approval(s)`)
          if (data?.length === 0) {
            log('DEBUG', 'usePendingApprovals — no pending leaves found (may be expected)')
          }
          setLeaves((data as any) ?? [])
        }
      } catch (err) {
        log('ERROR', 'usePendingApprovals — unexpected exception', err)
        setLeaves([])
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return {
    leaves,
    loading,
    refetch: () => { log('DEBUG', 'usePendingApprovals — refetch triggered'); setLoading(true) }
  }
}

// ── useLeaveBalance ───────────────────────────────────────────────────────────
export function useLeaveBalance() {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'useLeaveBalance mounted')

    const fetch = async () => {
      try {
        const resolved = await resolveEmployeeId(supabase, 'useLeaveBalance')
        if (!resolved) { setLoading(false); return }

        const currentYear = new Date().getFullYear()
        log('DEBUG', `useLeaveBalance — querying balances for employeeId=${resolved.employeeId}, year=${currentYear}`)

        const { data, error } = await supabase
          .from('employee_leave_balance')
          .select('*')
          .eq('employee_id', resolved.employeeId)
          .eq('year', currentYear)

        if (error) {
          log('ERROR', 'useLeaveBalance — query failed', {
            code: error.code,
            message: error.message,
            details: error.details,
          })
          setBalances([])
        } else {
          log('INFO', `useLeaveBalance — loaded ${data?.length ?? 0} balance record(s) for year=${currentYear}`)
          if (data?.length === 0) {
            log('WARN', `useLeaveBalance — no balance records found for employeeId=${resolved.employeeId}, year=${currentYear}. Leave balances may not be initialized.`)
          }
          setBalances((data as LeaveBalance[]) ?? [])
        }
      } catch (err) {
        log('ERROR', 'useLeaveBalance — unexpected exception', err)
        setBalances([])
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { balances, loading }
}