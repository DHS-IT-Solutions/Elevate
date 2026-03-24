// app/(dashboard)/onboarding/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, User, Save } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [OnboardingPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [OnboardingPage] ${message}`)
}

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [step, setStep]         = useState<'company' | 'profile'>('company')

  const [companyForm, setCompanyForm] = useState({
    name:     '',
    domain:   '',
    region:   'India',
    timezone: 'Asia/Kolkata',
  })

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name:  '',
    phone:      '',
    position:   '',
    department: '',
  })

  useEffect(() => {
    log('DEBUG', 'OnboardingPage mounted — checking onboarding status')
    checkIfOnboarded()
  }, [])

  // ── Onboarding check ────────────────────────────────────────────────────────
  const checkIfOnboarded = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        log('WARN', 'supabase.auth.getUser() error during onboarding check', {
          message: authError.message,
          status:  authError.status,
        })
        router.push('/login')
        return
      }

      if (!user) {
        log('WARN', 'No authenticated user — redirecting to /login')
        router.push('/login')
        return
      }

      log('DEBUG', 'Auth user resolved', { userId: user.id, email: user.email })

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, company_id')
        .eq('user_id', user.id)
        .single()

      if (empError && empError.code !== 'PGRST116') {
        // PGRST116 = no row found, which is the expected state for a new user
        log('ERROR', 'Failed to check employee record during onboarding', {
          userId:  user.id,
          code:    empError.code,
          message: empError.message,
        })
        // Fall through — show onboarding form rather than blocking
      }

      if (employee?.company_id) {
        log('INFO', 'User already onboarded — redirecting to /dashboard', {
          userId:     user.id,
          employeeId: employee.id,
          companyId:  employee.company_id,
        })
        router.push('/dashboard')
      } else {
        log('INFO', 'User not yet onboarded — showing onboarding form', {
          userId:         user.id,
          hasEmployeeRow: !!employee,
          hasCompanyId:   !!employee?.company_id,
        })
        setChecking(false)
      }

    } catch (err) {
      log('ERROR', 'Unexpected exception in checkIfOnboarded()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setChecking(false)
    }
  }

  // ── Step 1: Company form ────────────────────────────────────────────────────
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    log('INFO', 'Company step completed — advancing to profile step', {
      name:     companyForm.name,
      domain:   companyForm.domain || '(none)',
      region:   companyForm.region,
      timezone: companyForm.timezone,
    })
    setStep('profile')
  }

  // ── Step 2: Profile form + DB writes ───────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    log('INFO', 'Onboarding submission started', {
      company: companyForm.name,
      profile: `${profileForm.first_name} ${profileForm.last_name}`,
      region:  companyForm.region,
    })

    try {
      // ── Auth ────────────────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        log('ERROR', 'Auth check failed at profile submission', {
          authError: authError?.message ?? 'user is null',
        })
        throw new Error('Not authenticated')
      }

      log('DEBUG', 'Auth confirmed for submission', { userId: user.id })

      // ── Step 1: create company ──────────────────────────────────────────────
      log('DEBUG', 'Creating company record', {
        name:           companyForm.name,
        domain:         companyForm.domain || null,
        default_region: companyForm.region,
        timezone:       companyForm.timezone,
      })

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name:           companyForm.name,
          domain:         companyForm.domain || null,
          default_region: companyForm.region,
          timezone:       companyForm.timezone,
          is_active:      true,
        })
        .select()
        .single()

      if (companyError) {
        // Unique constraint on company name or domain
        if (companyError.code === '23505') {
          log('WARN', 'Company creation failed — duplicate name or domain', {
            name:   companyForm.name,
            domain: companyForm.domain,
            code:   companyError.code,
          })
        } else {
          log('ERROR', 'Failed to create company record', {
            code:    companyError.code,
            message: companyError.message,
            details: companyError.details,
            hint:    companyError.hint,
          })
        }
        throw companyError
      }

      log('INFO', 'Company created successfully', {
        companyId: company.id,
        name:      company.name,
      })

      // ── Step 2: create employee record ──────────────────────────────────────
      const employeeNumber = `EMP-${Date.now().toString().slice(-6)}`
      const startDate      = new Date().toISOString().split('T')[0]

      log('DEBUG', 'Creating employee record', {
        companyId:      company.id,
        userId:         user.id,
        employeeNumber,
        name:           `${profileForm.first_name} ${profileForm.last_name}`,
        email:          user.email,
        startDate,
      })

      const { data: insertedEmployee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          company_id:              company.id,
          user_id:                 user.id,
          employee_number:         employeeNumber,
          first_name:              profileForm.first_name,
          last_name:               profileForm.last_name,
          email:                   user.email!,
          phone:                   profileForm.phone    || null,
          position:                profileForm.position || null,
          department:              profileForm.department || null,
          region:                  companyForm.region,
          timezone:                companyForm.timezone,
          employment_start_date:   startDate,
          employment_status:       'active',
          is_active:               true,
        })
        .select()

      if (employeeError) {
        // If employee insert fails, the company was already created —
        // log a WARN so this orphaned company record is visible for cleanup.
        log('ERROR', 'Failed to create employee record — company was created but employee was not', {
          companyId:    company.id,
          userId:       user.id,
          code:         employeeError.code,
          message:      employeeError.message,
          details:      employeeError.details,
          hint:         employeeError.hint,
          orphanWarning: 'Company record may need manual cleanup if this error persists',
        })
        throw employeeError
      }

      log('INFO', 'Onboarding completed successfully', {
        companyId:  company.id,
        employeeId: insertedEmployee?.[0]?.id ?? 'unknown',
        userId:     user.id,
        name:       `${profileForm.first_name} ${profileForm.last_name}`,
      })

      log('DEBUG', 'Redirecting to /dashboard')
      router.push('/dashboard')

    } catch (err: any) {
      log('ERROR', 'Onboarding submission failed', {
        step:    'profile',
        message: err.message,
        code:    err.code ?? 'unknown',
      })
      setError(err.message)
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to DHS Elevate! 🎉</h1>
          <p className="text-gray-600">Let's get your company set up in 2 quick steps</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step === 'company' ? 'text-blue-600' : 'text-green-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'company' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
            }`}>
              {step === 'company' ? '1' : '✓'}
            </div>
            <span className="text-sm font-medium">Company</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300" />
          <div className={`flex items-center gap-2 ${step === 'profile' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step === 'profile' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
            <span className="text-sm font-medium">Your Profile</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          {step === 'company' ? (
            <form onSubmit={handleCompanySubmit} className="space-y-5">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g., DHS IT Solutions"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Domain (Optional)
                </label>
                <input
                  type="text"
                  value={companyForm.domain}
                  onChange={e => setCompanyForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="e.g., dhsitsolutions.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Region *
                  </label>
                  <select
                    value={companyForm.region}
                    onChange={e => {
                      const timezone = e.target.value === 'UK' ? 'Europe/London' : 'Asia/Kolkata'
                      log('DEBUG', 'Region changed — timezone auto-updated', {
                        region: e.target.value, timezone,
                      })
                      setCompanyForm(f => ({ ...f, region: e.target.value, timezone }))
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="India">India</option>
                    <option value="UK">UK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone *
                  </label>
                  <select
                    value={companyForm.timezone}
                    onChange={e => {
                      log('DEBUG', 'Timezone manually overridden', { timezone: e.target.value })
                      setCompanyForm(f => ({ ...f, timezone: e.target.value }))
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium 
                           hover:bg-blue-700 transition-colors"
              >
                Continue to Profile →
              </button>
            </form>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Your Profile</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 1234567890"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                  <input
                    type="text"
                    value={profileForm.position}
                    onChange={e => setProfileForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="e.g., CEO"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    value={profileForm.department}
                    onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="e.g., Executive"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm 
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    log('DEBUG', 'User navigated back to company step')
                    setStep('company')
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg font-medium 
                             text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white 
                             py-3 px-4 rounded-lg font-medium hover:bg-blue-700 
                             disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Creating...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}