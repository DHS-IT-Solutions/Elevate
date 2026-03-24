// components/settings/LeavePolicyManagement.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, FileText } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [LeavePolicyManagement] ${message}`, data)
    : fn(`[${ts}] [${level}] [LeavePolicyManagement] ${message}`)
}

interface LeavePolicy {
  id: string
  name: string
  leave_type: string
  annual_quota: number | null
  carry_forward_allowed: boolean | null
  max_carry_forward: number | null
  requires_approval: boolean | null
  region: string | null
  description: string | null
  is_active: boolean | null
}

export default function LeavePolicyManagement() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '',
    leave_type: 'annual_leave',
    annual_quota: 20,
    carry_forward_allowed: true,
    max_carry_forward: 5,
    requires_approval: true,
    region: 'India',
    description: '',
    is_active: true,
  })

  useEffect(() => {
    log('DEBUG', 'LeavePolicyManagement mounted — fetching policies')
    fetchPolicies()
  }, [])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchPolicies = async () => {
    log('DEBUG', 'fetchPolicies() called')
    setActionError(null)

    try {
      const { data, error } = await supabase
        .from('leave_policies')
        .select('*')
        .order('leave_type')

      if (error) {
        log('ERROR', 'Failed to fetch leave policies', {
          code: error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to load policies: ${error.message}`)
        setPolicies([])
      } else {
        log('INFO', `Loaded ${data?.length ?? 0} leave polic${data?.length === 1 ? 'y' : 'ies'}`)
        if (data?.length === 0) {
          log('DEBUG', 'No leave policies found — table may be empty or RLS is blocking access')
        }
        setPolicies((data as LeavePolicy[]) ?? [])
      }
    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchPolicies()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while loading policies')
      setPolicies([])
    } finally {
      setLoading(false)
    }
  }

  // ── Create / Update ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError(null)

    // Guard: annual_quota should not be NaN from parseInt on empty input
    if (isNaN(form.annual_quota)) {
      log('WARN', 'handleSubmit() blocked — annual_quota is NaN', { form })
      setActionError('Annual quota must be a valid number')
      return
    }

    if (editingId) {
      // ── Update path ─────────────────────────────────────────────────────────
      const existing = policies.find(p => p.id === editingId)
      log('INFO', 'Updating leave policy', {
        policyId: editingId,
        name: form.name,
        changes: {
          name: form.name !== existing?.name ? `"${existing?.name}" → "${form.name}"` : '(unchanged)',
          leave_type: form.leave_type !== existing?.leave_type ? `"${existing?.leave_type}" → "${form.leave_type}"` : '(unchanged)',
          annual_quota: form.annual_quota !== existing?.annual_quota ? `${existing?.annual_quota} → ${form.annual_quota}` : '(unchanged)',
          region: form.region !== existing?.region ? `"${existing?.region}" → "${form.region}"` : '(unchanged)',
          is_active: form.is_active !== existing?.is_active ? `${existing?.is_active} → ${form.is_active}` : '(unchanged)',
        },
      })

      try {
        const { error } = await supabase
          .from('leave_policies')
          .update(form)
          .eq('id', editingId)

        if (error) {
          log('ERROR', 'Failed to update leave policy', {
            policyId: editingId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
          setActionError(`Failed to update policy: ${error.message}`)
          return
        }

        log('INFO', 'Leave policy updated successfully', { policyId: editingId, name: form.name })

      } catch (err) {
        log('ERROR', 'Unexpected exception while updating leave policy', {
          policyId: editingId,
          error: err instanceof Error ? err.message : String(err),
        })
        setActionError('An unexpected error occurred while updating')
        return
      }

    } else {
      // ── Create path ─────────────────────────────────────────────────────────
      log('INFO', 'Creating new leave policy', {
        name: form.name,
        leave_type: form.leave_type,
        annual_quota: form.annual_quota,
        region: form.region,
        carry_forward_allowed: form.carry_forward_allowed,
        requires_approval: form.requires_approval,
        is_active: form.is_active,
      })

      try {
        const { data: inserted, error } = await supabase
          .from('leave_policies')
          .insert(form)
          .select()

        if (error) {
          log('ERROR', 'Failed to create leave policy', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
          setActionError(`Failed to create policy: ${error.message}`)
          return
        }

        log('INFO', 'Leave policy created successfully', {
          newId: inserted?.[0]?.id ?? 'unknown',
          name: form.name,
          leave_type: form.leave_type,
        })

      } catch (err) {
        log('ERROR', 'Unexpected exception while creating leave policy', {
          error: err instanceof Error ? err.message : String(err),
        })
        setActionError('An unexpected error occurred while creating')
        return
      }
    }

    log('DEBUG', 'Refreshing policy list after save')
    await fetchPolicies()
    resetForm()
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const policy = policies.find(p => p.id === id)
    log('DEBUG', 'Delete requested', {
      policyId: id,
      name: policy?.name ?? 'unknown',
      leave_type: policy?.leave_type ?? 'unknown',
    })

    if (!confirm('Delete this policy?')) {
      log('DEBUG', 'Delete cancelled by user', { policyId: id })
      return
    }

    log('INFO', 'Deleting leave policy', { policyId: id, name: policy?.name })
    setActionError(null)

    try {
      const { error } = await supabase
        .from('leave_policies')
        .delete()
        .eq('id', id)

      if (error) {
        log('ERROR', 'Failed to delete leave policy', {
          policyId: id,
          code: error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to delete policy: ${error.message}`)
        return
      }

      log('INFO', 'Leave policy deleted successfully', { policyId: id, name: policy?.name })
      log('DEBUG', 'Refreshing policy list after delete')
      await fetchPolicies()

    } catch (err) {
      log('ERROR', 'Unexpected exception while deleting leave policy', {
        policyId: id,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while deleting')
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = (policy: LeavePolicy) => {
    log('DEBUG', 'Edit initiated', {
      policyId: policy.id,
      name: policy.name,
      leave_type: policy.leave_type,
    })
    setActionError(null)
    setForm({
      name: policy.name,
      leave_type: policy.leave_type,
      annual_quota: policy.annual_quota ?? 20,
      carry_forward_allowed: policy.carry_forward_allowed ?? true,
      max_carry_forward: policy.max_carry_forward ?? 5,
      requires_approval: policy.requires_approval ?? true,
      region: policy.region ?? 'India',
      description: policy.description ?? '',
      is_active: policy.is_active ?? true,
    })
    setEditingId(policy.id)
    setShowModal(true)
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    log('DEBUG', 'resetForm() called — clearing form and closing modal', {
      wasEditing: editingId ?? 'none',
    })
    setForm({
      name: '',
      leave_type: 'annual_leave',
      annual_quota: 20,
      carry_forward_allowed: true,
      max_carry_forward: 5,
      requires_approval: true,
      region: 'India',
      description: '',
      is_active: true,
    })
    setEditingId(null)
    setShowModal(false)
    setActionError(null)
  }

  if (loading) return <div className="text-center py-12">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Leave Policies</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure leave types, quotas, and approval rules
          </p>
        </div>
        <button
          onClick={() => {
            log('DEBUG', 'Add Policy button clicked — opening modal')
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                     rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Policy
        </button>
      </div>

      {/* Page-level error banner */}
      {actionError && !showModal && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map(policy => (
          <div
            key={policy.id}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">
                  {policy.leave_type.replace('_', ' ')}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(policy)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(policy.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Annual Quota:</span>
                <span className="font-medium">{policy.annual_quota} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Carry Forward:</span>
                <span className="font-medium">
                  {policy.carry_forward_allowed
                    ? `Yes (max ${policy.max_carry_forward})`
                    : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Approval:</span>
                <span className="font-medium">
                  {policy.requires_approval ? 'Required' : 'Auto-approved'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Region:</span>
                <span className="font-medium">{policy.region ?? 'All'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  policy.is_active
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {policy.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {policy.description && (
              <p className="text-xs text-gray-500 mt-3 italic">{policy.description}</p>
            )}
          </div>
        ))}
      </div>

      {policies.length === 0 && (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900">No leave policies yet</p>
          <p className="text-sm text-gray-500 mt-1">Add your first policy to get started</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Policy' : 'Add Leave Policy'}
            </h3>

            {/* Modal-level error banner */}
            {actionError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g., Standard Annual Leave"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type *
                  </label>
                  <select
                    value={form.leave_type}
                    onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="annual_leave">Annual Leave</option>
                    <option value="sick_leave">Sick Leave</option>
                    <option value="work_from_home">Work From Home</option>
                    <option value="unpaid_leave">Unpaid Leave</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Annual Quota *
                  </label>
                  <input
                    type="number"
                    value={form.annual_quota}
                    onChange={e => {
                      const parsed = parseInt(e.target.value)
                      if (isNaN(parsed)) {
                        log('WARN', 'Annual quota input produced NaN', { raw: e.target.value })
                      }
                      setForm(f => ({ ...f, annual_quota: parsed }))
                    }}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region
                  </label>
                  <select
                    value={form.region}
                    onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="India">India</option>
                    <option value="UK">UK</option>
                    <option value="">All Regions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Carry Forward
                  </label>
                  <input
                    type="number"
                    value={form.max_carry_forward}
                    onChange={e => {
                      const parsed = parseInt(e.target.value)
                      if (isNaN(parsed)) {
                        log('WARN', 'Max carry forward input produced NaN', { raw: e.target.value })
                      }
                      setForm(f => ({ ...f, max_carry_forward: parsed }))
                    }}
                    min="0"
                    disabled={!form.carry_forward_allowed}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                               disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.carry_forward_allowed}
                    onChange={e => {
                      log('DEBUG', 'carry_forward_allowed toggled', { value: e.target.checked })
                      setForm(f => ({ ...f, carry_forward_allowed: e.target.checked }))
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Allow carry forward to next year
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requires_approval}
                    onChange={e => {
                      log('DEBUG', 'requires_approval toggled', { value: e.target.checked })
                      setForm(f => ({ ...f, requires_approval: e.target.checked }))
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Requires manager approval
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => {
                      log('DEBUG', 'is_active toggled', { value: e.target.checked })
                      setForm(f => ({ ...f, is_active: e.target.checked }))
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Active policy
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border 
                             border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 
                             rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Save Changes' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}