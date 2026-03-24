// components/settings/CompanySettings.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [CompanySettings] ${message}`, data)
    : fn(`[${ts}] [${level}] [CompanySettings] ${message}`)
}

interface Company {
  id: string
  name: string
  domain: string | null
  default_region: string | null
  timezone: string | null
  logo_url: string | null
}

export default function CompanySettings() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '',
    domain: '',
    default_region: 'India',
    timezone: 'Asia/Kolkata',
  })

  useEffect(() => {
    log('DEBUG', 'CompanySettings mounted — fetching company data')
    fetchCompany()
  }, [])

  const fetchCompany = async () => {
    log('DEBUG', 'fetchCompany() called')

    try {
      // ── Step 1: resolve auth user ───────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        log('WARN', 'supabase.auth.getUser() returned an error', {
          message: authError.message,
          status: authError.status,
        })
        setLoading(false)
        return
      }

      if (!user) {
        log('WARN', 'No authenticated user — cannot load company settings')
        setLoading(false)
        return
      }

      log('DEBUG', 'Auth user resolved', { userId: user.id, email: user.email })

      // ── Step 2: resolve employee → company_id ───────────────────────────────
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (empError) {
        if (empError.code === 'PGRST116') {
          log('WARN', 'No employee record found for this user', {
            userId: user.id,
            hint: 'User exists in auth but has no matching employees row',
          })
        } else {
          log('ERROR', 'Failed to fetch employee record', {
            code: empError.code,
            message: empError.message,
            details: empError.details,
          })
        }
        setLoading(false)
        return
      }

      if (!emp?.company_id) {
        log('WARN', 'Employee record has no company_id assigned', { userId: user.id })
        setLoading(false)
        return
      }

      log('DEBUG', 'Resolved company_id from employee', { company_id: emp.company_id })

      // ── Step 3: fetch company record ────────────────────────────────────────
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', emp.company_id)
        .single()

      if (companyError) {
        if (companyError.code === 'PGRST116') {
          log('WARN', 'No company record found for company_id', {
            company_id: emp.company_id,
            hint: 'The company_id on the employee row may be stale or invalid',
          })
        } else {
          log('ERROR', 'Failed to fetch company record', {
            company_id: emp.company_id,
            code: companyError.code,
            message: companyError.message,
            details: companyError.details,
          })
        }
        setLoading(false)
        return
      }

      if (!companyData) {
        log('WARN', 'Company query returned no data', { company_id: emp.company_id })
        setLoading(false)
        return
      }

      log('INFO', 'Company loaded successfully', {
        companyId: companyData.id,
        name: companyData.name,
        domain: companyData.domain,
        region: companyData.default_region,
        timezone: companyData.timezone,
      })

      setCompany(companyData as Company)
      setForm({
        name: companyData.name,
        domain: companyData.domain ?? '',
        default_region: companyData.default_region ?? 'India',
        timezone: companyData.timezone ?? 'Asia/Kolkata',
      })

      log('DEBUG', 'Form state initialised from company data')

    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchCompany()', {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!company) {
      log('WARN', 'handleSubmit() called but company state is null — submission blocked')
      return
    }

    log('INFO', 'Saving company settings', {
      companyId: company.id,
      changes: {
        name: form.name !== company.name ? `"${company.name}" → "${form.name}"` : '(unchanged)',
        domain: form.domain !== (company.domain ?? '') ? `"${company.domain}" → "${form.domain}"` : '(unchanged)',
        default_region: form.default_region !== company.default_region ? `"${company.default_region}" → "${form.default_region}"` : '(unchanged)',
        timezone: form.timezone !== company.timezone ? `"${company.timezone}" → "${form.timezone}"` : '(unchanged)',
      },
    })

    setSaving(true)
    setSaveError(null)

    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update(form)
        .eq('id', company.id)

      if (updateError) {
        log('ERROR', 'Failed to save company settings', {
          companyId: company.id,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        })
        setSaveError(updateError.message)
        alert(`Failed to save: ${updateError.message}`)
        return
      }

      log('INFO', 'Company settings saved successfully', { companyId: company.id })

      // Keep local state in sync so the "changed" diff above stays accurate
      setCompany(prev => prev ? { ...prev, ...form } : prev)
      alert('Company settings saved successfully!')

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleSubmit()', {
        companyId: company.id,
        error: err instanceof Error ? err.message : String(err),
      })
      setSaveError('An unexpected error occurred')
      alert('An unexpected error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading company settings...</div>
  }

  if (!company) {
    return <div className="text-center py-12 text-gray-500">Company not found</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
        <p className="text-sm text-gray-500 mt-1">
          Update your company's basic information and settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

        {/* Inline save error banner — visible to user without needing DevTools */}
        {saveError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            Save failed: {saveError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => {
              log('DEBUG', 'Form field changed: name')
              setForm(f => ({ ...f, name: e.target.value }))
            }}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Domain
          </label>
          <input
            type="text"
            value={form.domain}
            onChange={e => {
              log('DEBUG', 'Form field changed: domain')
              setForm(f => ({ ...f, domain: e.target.value }))
            }}
            placeholder="e.g., dhsitsolutions.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Region *
            </label>
            <select
              value={form.default_region}
              onChange={e => {
                log('DEBUG', 'Form field changed: default_region', { value: e.target.value })
                setForm(f => ({ ...f, default_region: e.target.value }))
              }}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="India">India</option>
              <option value="UK">UK</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Timezone *
            </label>
            <select
              value={form.timezone}
              onChange={e => {
                log('DEBUG', 'Form field changed: timezone', { value: e.target.value })
                setForm(f => ({ ...f, timezone: e.target.value }))
              }}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 
                       rounded-lg text-sm font-medium hover:bg-blue-700 
                       disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}