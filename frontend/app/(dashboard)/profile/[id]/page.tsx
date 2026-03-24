// app/(dashboard)/profile/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/shared/Avatar'
import type { Employee } from '@/types/employee'
import {
  Mail, Phone, MapPin, Calendar, Building2, User,
  Linkedin, Edit2, ArrowLeft, Globe, Clock, Briefcase
} from 'lucide-react'
import Link from 'next/link'
import { usePermission, useUserRoles, PERMISSIONS } from '@/lib/rbac/hooks'


// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [ProfilePage] ${message}`, data)
    : fn(`[${ts}] [${level}] [ProfilePage] ${message}`)
}

type Tab = 'personal' | 'employment' | 'notes'

export default function ProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp, setEmp] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('personal')
  const supabase = createClient()
  const { hasPermission: canEditAll } = usePermission(PERMISSIONS.EMPLOYEES.UPDATE_ALL)
  const { hasPermission: canEditOwn } = usePermission(PERMISSIONS.EMPLOYEES.UPDATE_OWN)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      log('WARN', 'Profile page mounted with no id param — cannot fetch employee')
      setLoading(false)
      return
    }

    log('DEBUG', 'ProfilePage mounted — fetching employee', { employeeId: id })

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('id', id as string)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            log('WARN', 'Employee not found', {
              employeeId: id,
              hint: 'ID in URL may be invalid, deleted, or RLS is blocking access',
            })
          } else {
            log('ERROR', 'Failed to fetch employee profile', {
              employeeId: id,
              code: error.code,
              message: error.message,
              details: error.details,
            })
          }
          setLoading(false)
          return
        }

        log('INFO', 'Employee profile loaded', {
          employeeId: data.id,
          name: `${data.first_name} ${data.last_name}`,
          status: data.employment_status,
          region: data.region,
          position: data.position ?? '(none)',
          department: data.department ?? '(none)',
        })

        setEmp(data as Employee)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: me } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', user.id)
            .single()
          if (me) setCurrentUserId(me.id)
        }

      } catch (err) {
        log('ERROR', 'Unexpected exception fetching employee profile', {
          employeeId: id,
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [id])

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-32" />
      <div className="bg-gray-200 rounded-xl h-48" />
    </div>
  )

  if (!emp) return (
    <div className="text-center py-20 text-gray-500">
      <p className="text-lg font-medium">Employee not found</p>
      <Link href="/company" className="text-blue-600 text-sm mt-2 inline-block">
        ← Back to directory
      </Link>
    </div>
  )

  const fullName = `${emp.first_name} ${emp.last_name}`

  const tabs: { id: Tab; label: string }[] = [
    { id: 'personal', label: 'Personal' },
    { id: 'employment', label: 'Employment' },
    { id: 'notes', label: 'Notes' },
  ]

  // ADD before the main return:
  const isOwnProfile = currentUserId === emp.id
  const canEdit = canEditAll || (canEditOwn && isOwnProfile)

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <button
        onClick={() => {
          log('DEBUG', 'Back button clicked', { employeeId: emp.id })
          router.back()
        }}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Profile header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="flex items-start gap-5">
          <Avatar name={fullName} imageUrl={emp.profile_picture_url} size="xl" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${emp.employment_status === 'active'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                {emp.employment_status}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${emp.region === 'UK'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>
                {emp.region}
              </span>
            </div>

            <p className="text-gray-600 mt-1">{emp.position ?? 'No position set'}</p>
            {emp.department && (
              <p className="text-sm text-gray-400 mt-0.5">{emp.department}</p>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
              <a href={`mailto:${emp.email}`}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600">
                <Mail className="w-4 h-4" /> {emp.email}
              </a>
              {emp.phone && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Phone className="w-4 h-4" /> {emp.phone}
                </span>
              )}
              {emp.location && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" /> {emp.location}
                </span>
              )}
              {emp.linkedin_url && (
                <a href={emp.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
              )}
            </div>
          </div>

          {canEdit && (
            <Link
              href={`/profile/${id}/edit`}
              onClick={() => log('DEBUG', 'Edit profile link clicked', { employeeId: emp.id })}
              className="flex items-center gap-1.5 text-sm border border-gray-200 
               rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id !== tab) {
                log('DEBUG', `Profile tab changed to "${t.id}"`, { employeeId: emp.id })
                setTab(t.id)
              }
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">

        {tab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field icon={User} label="First Name" value={emp.first_name} />
            <Field icon={User} label="Last Name" value={emp.last_name} />
            <Field icon={Mail} label="Work Email" value={emp.email} />
            <Field icon={Phone} label="Phone" value={emp.phone} />
            <Field icon={Calendar} label="Date of Birth" value={emp.date_of_birth
              ? new Date(emp.date_of_birth).toLocaleDateString() : undefined} />
            <Field icon={User} label="Gender" value={emp.gender} />
            <Field icon={MapPin} label="Location" value={emp.location} />
            <Field icon={Globe} label="Region" value={emp.region} />
            <Field icon={Clock} label="Timezone" value={emp.timezone} />
            <Field icon={Linkedin} label="LinkedIn" value={emp.linkedin_url} link />
            {emp.bio && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bio</p>
                <p className="text-sm text-gray-700 leading-relaxed">{emp.bio}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'employment' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field icon={Briefcase} label="Employee #" value={emp.employee_number} />
            <Field icon={Briefcase} label="Position" value={emp.position} />
            <Field icon={Building2} label="Department" value={emp.department} />
            <Field icon={Calendar} label="Start Date" value={emp.employment_start_date
              ? new Date(emp.employment_start_date).toLocaleDateString() : undefined} />
            <Field icon={Calendar} label="End Date" value={emp.employment_end_date
              ? new Date(emp.employment_end_date).toLocaleDateString() : 'Current'} />
            <Field icon={User} label="Status" value={emp.employment_status} />
            <Field icon={MapPin} label="Work Location" value={emp.work_location} />
          </div>
        )}

        {tab === 'notes' && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No notes yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Field — pure display, no logging needed ───────────────────────────────────
function Field({
  icon: Icon, label, value, link = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string | null
  link?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate">{value}</a>
          ) : (
            <p className="text-sm text-gray-900">{value}</p>
          )
        ) : (
          <p className="text-sm text-gray-400 italic">Not set</p>
        )}
      </div>
    </div>
  )
}