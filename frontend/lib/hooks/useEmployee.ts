// lib/hooks/useEmployee.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/types/employee'

const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined ? fn(`[${ts}] [${level}] [useEmployee] ${message}`, data) : fn(`[${ts}] [${level}] [useEmployee] ${message}`)
}

export function useEmployee(userId?: string) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', `useEmployee mounted`, { providedUserId: userId ?? '(none — will use auth user)' })

    const fetch = async () => {
      try {
        let resolvedUserId = userId

        if (!resolvedUserId) {
          log('DEBUG', 'No userId prop — resolving from supabase.auth.getUser()')
          const { data: { user }, error: authError } = await supabase.auth.getUser()

          if (authError) {
            log('WARN', 'supabase.auth.getUser() error in useEmployee', {
              message: authError.message,
              status: authError.status,
            })
            setLoading(false)
            return
          }

          if (!user) {
            log('WARN', 'No authenticated user found — cannot load employee')
            setLoading(false)
            return
          }

          resolvedUserId = user.id
          log('DEBUG', 'Resolved auth userId', { userId: resolvedUserId })
        }

        log('DEBUG', `Querying employees table`, { user_id: resolvedUserId })
        const { data, error: queryError } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', resolvedUserId)
          .single()

        if (queryError) {
          // PGRST116 = no rows found — a common and meaningful failure worth surfacing clearly
          if (queryError.code === 'PGRST116') {
            log('WARN', 'No employee record found for user_id', {
              user_id: resolvedUserId,
              hint: 'The user exists in auth but has no matching employees row',
            })
          } else {
            log('ERROR', 'Supabase query error in useEmployee', {
              code: queryError.code,
              message: queryError.message,
              details: queryError.details,
              hint: queryError.hint,
            })
          }
          setError(queryError.message)
        } else {
          log('INFO', 'Employee loaded successfully', {
            employeeId: data?.id,
            name: `${data?.first_name} ${data?.last_name}`,
            team_id: data?.team_id,
            is_active: data?.is_active,
          })
          setEmployee(data as Employee)
        }
      } catch (err) {
        log('ERROR', 'Unexpected exception in useEmployee fetch()', err)
        setError('Failed to load employee')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [userId])

  return { employee, loading, error }
}

export function useAllEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'useAllEmployees mounted — fetching all active employees')

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('is_active', true)
          .order('first_name')

        if (error) {
          log('ERROR', 'Failed to fetch all employees', {
            code: error.code,
            message: error.message,
            details: error.details,
          })
          setEmployees([])
        } else {
          log('INFO', `Loaded ${data?.length ?? 0} active employees`)
          setEmployees((data as Employee[]) ?? [])
        }
      } catch (err) {
        log('ERROR', 'Unexpected exception in useAllEmployees fetch()', err)
        setEmployees([])
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  return { employees, loading }
}