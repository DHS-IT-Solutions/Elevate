// app/(dashboard)/settings/invite/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import { UserPlus, Copy, Check, Plus, Trash2, Monitor } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePermission, ProtectedRoute, PERMISSIONS } from '@/lib/rbac/hooks'


// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [InviteEmployeePage] ${message}`, data)
    : fn(`[${ts}] [${level}] [InviteEmployeePage] ${message}`)
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// ── Shared field/section layout helpers ──────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3
                     pb-2 border-b border-gray-100">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function InviteEmployeePage() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { hasPermission: canInvite, loading: rbacLoading } = usePermission(PERMISSIONS.EMPLOYEES.INVITE)

  const fieldClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`

  const [form, setForm] = useState({
    // ── Basic ──────────────────────────────────────────────────────────────
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    linkedin_url: '',
    temp_password: generatePassword(),
    // ── Employment ────────────────────────────────────────────────────────
    position: '',
    department: '',
    employment_start_date: new Date().toISOString().split('T')[0],
    employment_status: 'active',
    // ── Location & Region ─────────────────────────────────────────────────
    region: 'India',
    timezone: 'Asia/Kolkata',
    work_location: 'office',
    location: '',
  })

  interface DeviceEntry {
    device_type: string
    brand: string
    model: string
    serial_number: string
    asset_tag: string
    notes: string
  }

  const emptyDevice: DeviceEntry = {
    device_type: 'laptop', brand: '', model: '', serial_number: '', asset_tag: '', notes: '',
  }

  const [devices, setDevices] = useState<DeviceEntry[]>([])

  const addDevice = () => setDevices(d => [...d, { ...emptyDevice }])
  const removeDevice = (i: number) => setDevices(d => d.filter((_, idx) => idx !== i))
  const updateDevice = (i: number, key: keyof DeviceEntry, value: string) =>
    setDevices(d => d.map((dev, idx) => idx === i ? { ...dev, [key]: value } : dev))

  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  useEffect(() => {
    log('DEBUG', 'InviteEmployeePage mounted — resolving companyId')
    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: emp } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      if (emp?.company_id) setCompanyId(emp.company_id)
    }
    resolve()
  }, [])

  const copyPassword = () => {
    navigator.clipboard.writeText(form.temp_password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canInvite || !companyId) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    log('INFO', 'Employee invite submission started', {
      email: form.email,
      name: `${form.first_name} ${form.last_name}`,
      region: form.region,
      companyId,
    })

    try {
      log('DEBUG', 'Creating auth user via signUp', { email: form.email })

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.temp_password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
          },
        },
      })

      if (authError) {
        if (authError.status === 422 ||
          authError.message.toLowerCase().includes('already registered')) {
          log('WARN', 'Invite failed — email already registered', {
            email: form.email, status: authError.status, message: authError.message,
          })
        } else {
          log('ERROR', 'Auth user creation failed', {
            email: form.email, status: authError.status, message: authError.message,
          })
        }
        throw authError
      }

      if (authData.user?.identities?.length === 0) {
        log('WARN', 'signUp returned empty identities — email already exists', {
          email: form.email,
          hint: 'Supabase suppresses duplicate email errors when confirmations are on',
        })
        throw new Error('An account with this email already exists.')
      }

      if (!authData.user) {
        log('WARN', 'signUp succeeded but returned no user object', { email: form.email })
        throw new Error('Account creation returned no user. Please try again.')
      }

      log('INFO', 'Auth user created', { newUserId: authData.user.id, email: form.email })

      // ── Create employee record ──────────────────────────────────────────────
      const empNum = `EMP-${Date.now().toString().slice(-6)}`

      log('DEBUG', 'Creating employee record', {
        companyId, userId: authData.user.id, employeeNumber: empNum,
      })

      const { data: insertedEmp, error: empError } = await supabase
        .from('employees')
        .insert({
          company_id: companyId,
          user_id: authData.user.id,
          employee_number: empNum,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          position: form.position || null,
          department: form.department || null,
          bio: form.bio || null,
          linkedin_url: form.linkedin_url || null,
          region: form.region,
          timezone: form.timezone,
          employment_start_date: form.employment_start_date,
          employment_status: form.employment_status,
          work_location: form.work_location,
          location: form.location || null,
          is_active: form.employment_status === 'active',
        })
        .select()

      if (empError) {
        log('ERROR', 'Employee record creation failed — auth user was created but employee was not', {
          newUserId: authData.user.id,
          companyId,
          code: empError.code,
          message: empError.message,
          hint: 'Orphaned auth user may need manual cleanup in Supabase Auth dashboard',
        })
        throw empError
      }

      const newEmployeeId = insertedEmp?.[0]?.id

      log('INFO', 'Employee record created', {
        employeeId: newEmployeeId, employeeNumber: empNum,
        name: `${form.first_name} ${form.last_name}`,
      })

      // ── Assign default employee role ────────────────────────────────────────
      const { data: empRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'employee')
        .single()

      if (roleError || !empRole) {
        log('WARN', 'Could not find "employee" role — skipping role assignment', {
          employeeId: newEmployeeId,
          hint: 'Create an "employee" role in the roles table',
        })
      } else if (newEmployeeId) {
        const { error: roleAssignError } = await supabase
          .from('employee_roles')
          .insert({ employee_id: newEmployeeId, role_id: empRole.id })

        if (roleAssignError) {
          log('WARN', 'Role assignment failed — employee created but has no role', {
            employeeId: newEmployeeId, roleId: empRole.id,
            code: roleAssignError.code, message: roleAssignError.message,
          })
        } else {
          log('INFO', 'Default employee role assigned', { employeeId: newEmployeeId })
        }
      }

      // ── Insert devices ────────────────────────────────────────────────────
      if (devices.length > 0 && newEmployeeId) {
        const deviceRows = devices.map(d => ({
          employee_id: newEmployeeId,
          device_type: d.device_type,
          brand: d.brand || null,
          model: d.model || null,
          serial_number: d.serial_number || null,
          asset_tag: d.asset_tag || null,
          notes: d.notes || null,
        }))

        const { error: deviceError } = await supabase
          .from('employee_devices' as any)
          .insert(deviceRows)

        if (deviceError) {
          log('WARN', 'Device records insert failed', {
            employeeId: newEmployeeId,
            code: deviceError.code,
            message: deviceError.message,
          })
        } else {
          log('INFO', `Inserted ${devices.length} device(s)`, { employeeId: newEmployeeId })
        }
      }

      log('INFO', 'Invite completed successfully', {
        employeeId: newEmployeeId, email: form.email,
      })

      setSuccess(
        `✅ Employee account created successfully!\n\n` +
        `📧 Email: ${form.email}\n` +
        `🔑 Temporary Password: ${form.temp_password}\n\n` +
        `Share these credentials with the employee. They should change their password on first login.`
      )

      setForm({
        email: '', first_name: '', last_name: '', phone: '', bio: '', linkedin_url: '',
        temp_password: generatePassword(),
        position: '', department: '',
        employment_start_date: new Date().toISOString().split('T')[0],
        employment_status: 'active',
        region: 'India', timezone: 'Asia/Kolkata',
        work_location: 'office', location: '',
      })
      setDevices([])

    } catch (err: any) {
      log('ERROR', 'Invite submission failed', {
        email: form.email, message: err.message, code: err.code ?? 'unknown',
      })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (rbacLoading) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Invite Employee" subtitle="Checking permissions..." />
        <div className="animate-pulse bg-gray-100 rounded-lg h-32" />
      </div>
    )
  }

  // ── Access denied ───────────────────────────────────────────────────────────
  if (!canInvite) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Access Denied" subtitle="This page is for administrators only" />
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          You do not have permission to invite employees.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Invite Employee"
        subtitle="Create a new employee account and send credentials"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-lg text-sm mb-6 whitespace-pre-wrap">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">

        {/* ── Personal Details ─────────────────────────────────────────────── */}
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *">
              <input className={fieldClass} required value={form.first_name} onChange={set('first_name')} />
            </Field>
            <Field label="Last Name *">
              <input className={fieldClass} required value={form.last_name} onChange={set('last_name')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Work Email *">
              <input className={fieldClass} type="email" required value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <input className={fieldClass} value={form.phone} onChange={set('phone')} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Bio">
              <textarea className={`${fieldClass} h-20 resize-none`} value={form.bio} onChange={set('bio')} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="LinkedIn URL">
              <input className={fieldClass} placeholder="https://linkedin.com/in/..."
                value={form.linkedin_url} onChange={set('linkedin_url')} />
            </Field>
          </div>
        </Section>

        {/* ── Employment ───────────────────────────────────────────────────── */}
        <Section title="Employment">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Position">
              <input className={fieldClass} value={form.position} onChange={set('position')} />
            </Field>
            <Field label="Department">
              <input className={fieldClass} value={form.department} onChange={set('department')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Start Date *">
              <input className={fieldClass} type="date" required
                value={form.employment_start_date} onChange={set('employment_start_date')} />
            </Field>
            <Field label="Status">
              <select className={fieldClass} value={form.employment_status} onChange={set('employment_status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Location & Region ─────────────────────────────────────────────── */}
        <Section title="Location & Region">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Region *">
              <select className={fieldClass} value={form.region} onChange={e => {
                const r = e.target.value
                const timezone = r === 'UK' ? 'Europe/London' : 'Asia/Kolkata'
                log('DEBUG', 'Region changed — timezone auto-updated', { region: r, timezone })
                setForm(f => ({ ...f, region: r, timezone }))
              }}>
                <option value="India">India</option>
                <option value="UK">UK</option>
              </select>
            </Field>
            <Field label="Timezone">
              <select className={fieldClass} value={form.timezone} onChange={e => {
                log('DEBUG', 'Timezone manually overridden', { timezone: e.target.value })
                setForm(f => ({ ...f, timezone: e.target.value }))
              }}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Location">
              <input className={fieldClass} placeholder="e.g. Chennai, India"
                value={form.location} onChange={set('location')} />
            </Field>
            <Field label="Work Location">
              <select className={fieldClass} value={form.work_location} onChange={set('work_location')}>
                <option value="office">Office</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Company Devices ──────────────────────────────────────────────── */}
        <Section title="Company Devices">
          {devices.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Monitor className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">No devices assigned yet</p>
              <button type="button" onClick={addDevice}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
                <Plus className="w-4 h-4" /> Add Device
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((dev, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative">
                  <button type="button" onClick={() => removeDevice(i)}
                    className="absolute top-3 right-3 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <p className="text-xs font-semibold text-gray-500 mb-3">Device {i + 1}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Device Type *">
                      <select className={fieldClass} value={dev.device_type}
                        onChange={e => updateDevice(i, 'device_type', e.target.value)}>
                        <option value="laptop">Laptop</option>
                        <option value="desktop">Desktop</option>
                        <option value="monitor">Monitor</option>
                        <option value="phone">Phone</option>
                        <option value="tablet">Tablet</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field label="Brand">
                      <input className={fieldClass} placeholder="e.g. Dell, Apple"
                        value={dev.brand} onChange={e => updateDevice(i, 'brand', e.target.value)} />
                    </Field>
                    <Field label="Model">
                      <input className={fieldClass} placeholder="e.g. MacBook Pro 14"
                        value={dev.model} onChange={e => updateDevice(i, 'model', e.target.value)} />
                    </Field>
                    <Field label="Serial Number">
                      <input className={fieldClass} placeholder="e.g. SN-123456"
                        value={dev.serial_number} onChange={e => updateDevice(i, 'serial_number', e.target.value)} />
                    </Field>
                    <Field label="Asset Tag">
                      <input className={fieldClass} placeholder="e.g. AST-001"
                        value={dev.asset_tag} onChange={e => updateDevice(i, 'asset_tag', e.target.value)} />
                    </Field>
                    <Field label="Notes">
                      <input className={fieldClass} placeholder="Any additional info"
                        value={dev.notes} onChange={e => updateDevice(i, 'notes', e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addDevice}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
                <Plus className="w-4 h-4" /> Add Another Device
              </button>
            </div>
          )}
        </Section>

        {/* ── Credentials ──────────────────────────────────────────────────── */}
        <Section title="Credentials">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <Field label="Temporary Password">
              <div className="flex items-center gap-2 mt-1">
                <input type="text" value={form.temp_password} readOnly
                  className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white font-mono" />
                <button type="button" onClick={copyPassword}
                  className="p-2 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors">
                  {copied
                    ? <Check className="w-4 h-4 text-green-600" />
                    : <Copy className="w-4 h-4 text-amber-700" />}
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, temp_password: generatePassword() }))}
                  className="text-sm text-amber-700 hover:text-amber-800 font-medium whitespace-nowrap">
                  Regenerate
                </button>
              </div>
            </Field>
            <p className="text-xs text-amber-700 mt-2">
              💡 Save this password! You'll need to share it with the employee.
            </p>
          </div>
        </Section>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5
                       rounded-lg text-sm font-medium hover:bg-blue-700
                       disabled:opacity-50 transition-colors">
            <UserPlus className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Employee Account'}
          </button>
        </div>
      </form>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-medium mb-2">📋 Next Steps:</p>
        <ol className="text-sm text-blue-700 space-y-1 ml-4 list-decimal">
          <li>Copy the employee's email and temporary password</li>
          <li>Send them via secure channel (email, Slack, etc.)</li>
          <li>Ask them to login and change password immediately</li>
        </ol>
      </div>
    </div>
  )
}