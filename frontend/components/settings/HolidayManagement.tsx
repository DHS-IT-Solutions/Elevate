// components/settings/HolidayManagement.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [HolidayManagement] ${message}`, data)
    : fn(`[${ts}] [${level}] [HolidayManagement] ${message}`)
}

interface Holiday {
  id: string
  name: string
  date: string
  region: string
  is_public: boolean | null
  is_optional: boolean | null
  description: string | null
}

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '',
    date: '',
    region: 'India',
    is_public: true,
    is_optional: false,
    description: '',
  })

  useEffect(() => {
    log('DEBUG', 'HolidayManagement mounted — fetching holidays')
    fetchHolidays()
  }, [])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchHolidays = async () => {
    log('DEBUG', 'fetchHolidays() called')
    setActionError(null)

    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true })

      if (error) {
        log('ERROR', 'Failed to fetch holidays', {
          code: error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to load holidays: ${error.message}`)
        setHolidays([])
      } else {
        log('INFO', `Loaded ${data?.length ?? 0} holiday(s)`)
        if (data?.length === 0) {
          log('DEBUG', 'No holidays found in database — table may be empty')
        }
        setHolidays((data as Holiday[]) ?? [])
      }
    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchHolidays()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while loading holidays')
      setHolidays([])
    } finally {
      setLoading(false)
    }
  }

  // ── Create / Update ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError(null)

    if (editingId) {
      // ── Update path ───────────────────────────────────────────────────────
      log('INFO', 'Updating holiday', {
        holidayId: editingId,
        name: form.name,
        date: form.date,
        region: form.region,
        is_public: form.is_public,
        is_optional: form.is_optional,
      })

      try {
        const { error } = await supabase
          .from('holidays')
          .update(form)
          .eq('id', editingId)

        if (error) {
          log('ERROR', 'Failed to update holiday', {
            holidayId: editingId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
          setActionError(`Failed to update holiday: ${error.message}`)
          return
        }

        log('INFO', 'Holiday updated successfully', { holidayId: editingId, name: form.name })

      } catch (err) {
        log('ERROR', 'Unexpected exception while updating holiday', {
          holidayId: editingId,
          error: err instanceof Error ? err.message : String(err),
        })
        setActionError('An unexpected error occurred while updating')
        return
      }

    } else {
      // ── Create path ───────────────────────────────────────────────────────
      log('INFO', 'Creating new holiday', {
        name: form.name,
        date: form.date,
        region: form.region,
        is_public: form.is_public,
        is_optional: form.is_optional,
      })

      try {
        const { data: inserted, error } = await supabase
          .from('holidays')
          .insert(form)
          .select()

        if (error) {
          log('ERROR', 'Failed to create holiday', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
          setActionError(`Failed to create holiday: ${error.message}`)
          return
        }

        log('INFO', 'Holiday created successfully', {
          newId: inserted?.[0]?.id ?? 'unknown',
          name: form.name,
        })

      } catch (err) {
        log('ERROR', 'Unexpected exception while creating holiday', {
          error: err instanceof Error ? err.message : String(err),
        })
        setActionError('An unexpected error occurred while creating')
        return
      }
    }

    log('DEBUG', 'Refreshing holiday list after save')
    await fetchHolidays()
    resetForm()
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const holiday = holidays.find(h => h.id === id)
    log('DEBUG', 'Delete requested', { holidayId: id, name: holiday?.name ?? 'unknown' })

    if (!confirm('Delete this holiday?')) {
      log('DEBUG', 'Delete cancelled by user', { holidayId: id })
      return
    }

    log('INFO', 'Deleting holiday', { holidayId: id, name: holiday?.name })
    setActionError(null)

    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id)

      if (error) {
        log('ERROR', 'Failed to delete holiday', {
          holidayId: id,
          code: error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to delete holiday: ${error.message}`)
        return
      }

      log('INFO', 'Holiday deleted successfully', { holidayId: id, name: holiday?.name })
      log('DEBUG', 'Refreshing holiday list after delete')
      await fetchHolidays()

    } catch (err) {
      log('ERROR', 'Unexpected exception while deleting holiday', {
        holidayId: id,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while deleting')
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = (holiday: Holiday) => {
    log('DEBUG', 'Edit initiated', { holidayId: holiday.id, name: holiday.name })
    setActionError(null)
    setForm({
      name: holiday.name,
      date: holiday.date,
      region: holiday.region,
      is_public: holiday.is_public ?? true,
      is_optional: holiday.is_optional ?? false,
      description: holiday.description ?? '',
    })
    setEditingId(holiday.id)
    setShowModal(true)
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    log('DEBUG', 'resetForm() called — clearing form and closing modal', {
      wasEditing: editingId ?? 'none',
    })
    setForm({
      name: '',
      date: '',
      region: 'India',
      is_public: true,
      is_optional: false,
      description: '',
    })
    setEditingId(null)
    setShowModal(false)
    setActionError(null)
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Public Holidays</h2>
          <p className="text-sm text-gray-500 mt-1">Manage region-specific holidays</p>
        </div>
        <button
          onClick={() => {
            log('DEBUG', 'Add Holiday button clicked — opening modal')
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                     rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Holiday
        </button>
      </div>

      {/* Inline error banner */}
      {actionError && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {actionError}
        </div>
      )}

      {/* Holidays List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Holiday Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Region</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {holidays.map(holiday => (
              <tr key={holiday.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{holiday.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(holiday.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    holiday.region === 'India'
                      ? 'bg-orange-50 text-orange-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {holiday.region}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {holiday.is_optional ? 'Optional' : 'Public'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(holiday)}
                    className="text-blue-600 hover:text-blue-700 p-1"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(holiday.id)}
                    className="text-red-600 hover:text-red-700 p-1 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {holidays.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No holidays added yet</p>
            <p className="text-sm mt-1">Click "Add Holiday" to get started</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Holiday' : 'Add New Holiday'}
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
                  Holiday Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g., Independence Day"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                <select
                  value={form.region}
                  onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="India">India</option>
                  <option value="UK">UK</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Public Holiday
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_optional}
                    onChange={e => setForm(f => ({ ...f, is_optional: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Optional
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                  {editingId ? 'Save Changes' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}