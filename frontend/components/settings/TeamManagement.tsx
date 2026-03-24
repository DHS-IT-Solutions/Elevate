// components/settings/TeamManagement.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [TeamManagement] ${message}`, data)
    : fn(`[${ts}] [${level}] [TeamManagement] ${message}`)
}

interface Team {
  id: string
  name: string
  description: string | null
  manager_id: string | null
  region: string | null
  is_active: boolean | null
  member_count?: number
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '',
    description: '',
    region: 'India',
    is_active: true,
  })

  useEffect(() => {
    log('DEBUG', 'TeamManagement mounted — fetching teams')
    fetchTeams()
  }, [])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTeams = async () => {
    log('DEBUG', 'fetchTeams() called')
    setActionError(null)

    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name')

      if (error) {
        log('ERROR', 'Failed to fetch teams', {
          code: error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to load teams: ${error.message}`)
        setTeams([])
        setLoading(false)
        return
      }

      log('DEBUG', `Fetched ${data?.length ?? 0} team(s) — fetching member counts`)

      // ── Member counts via Promise.all ───────────────────────────────────────
      // Each count is fetched independently; log individual failures without
      // aborting the whole list.
      const teamsWithCounts = await Promise.all(
        (data ?? []).map(async team => {
          try {
            const { count, error: countError } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id)

            if (countError) {
              log('WARN', `Failed to fetch member count for team "${team.name}"`, {
                teamId: team.id,
                code: countError.code,
                message: countError.message,
              })
              return { ...team, member_count: 0 }
            }

            log('DEBUG', `Member count for team "${team.name}": ${count ?? 0}`)
            return { ...team, member_count: count ?? 0 }

          } catch (err) {
            log('ERROR', `Unexpected exception fetching member count for team "${team.name}"`, {
              teamId: team.id,
              error: err instanceof Error ? err.message : String(err),
            })
            return { ...team, member_count: 0 }
          }
        })
      )

      log('INFO', `Loaded ${teamsWithCounts.length} team(s) with member counts`, {
        summary: teamsWithCounts.map(t => ({
          name: t.name,
          region: t.region ?? 'All',
          members: t.member_count,
          active: t.is_active,
        })),
      })

      setTeams(teamsWithCounts as Team[])

    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchTeams()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while loading teams')
      setTeams([])
    } finally {
      setLoading(false)
    }
  }

  // ── Create / Update ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError(null)

    if (editingId) {
      // ── Update path ─────────────────────────────────────────────────────────
      const existing = teams.find(t => t.id === editingId)
      log('INFO', 'Updating team', {
        teamId: editingId,
        changes: {
          name: form.name !== existing?.name
            ? `"${existing?.name}" → "${form.name}"` : '(unchanged)',
          description: form.description !== (existing?.description ?? '')
            ? 'changed' : '(unchanged)',
          region: form.region !== existing?.region
            ? `"${existing?.region}" → "${form.region}"` : '(unchanged)',
          is_active: form.is_active !== existing?.is_active
            ? `${existing?.is_active} → ${form.is_active}` : '(unchanged)',
        },
      })

      try {
        const { error } = await supabase
          .from('teams')
          .update(form)
          .eq('id', editingId)

        if (error) {
          log('ERROR', 'Failed to update team', {
            teamId: editingId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
          setActionError(`Failed to update team: ${error.message}`)
          return
        }

        log('INFO', 'Team updated successfully', { teamId: editingId, name: form.name })

      } catch (err) {
        log('ERROR', 'Unexpected exception while updating team', {
          teamId: editingId,
          error: err instanceof Error ? err.message : String(err),
        })
        setActionError('An unexpected error occurred while updating')
        return
      }

    } else {
      // ── Create path ─────────────────────────────────────────────────────────
      log('INFO', 'Creating new team', {
        name: form.name,
        region: form.region,
        is_active: form.is_active,
        hasDescription: !!form.description,
      })

      try {
        const { data: inserted, error } = await supabase
          .from('teams')
          .insert(form)
          .select()

        if (error) {
          // Postgres unique constraint on team name
          if (error.code === '23505') {
            log('WARN', 'Unique constraint — a team with this name may already exist', {
              name: form.name,
              code: error.code,
            })
            setActionError(`A team named "${form.name}" already exists`)
          } else {
            log('ERROR', 'Failed to create team', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            })
            setActionError(`Failed to create team: ${error.message}`)
          }
          return
        }

        log('INFO', 'Team created successfully', {
          newId: inserted?.[0]?.id ?? 'unknown',
          name: form.name,
          region: form.region,
        })

      } catch (err) {
        log('ERROR', 'Unexpected exception while creating team', {
          error: err instanceof Error ? err.message : String(err),
        })
        setActionError('An unexpected error occurred while creating')
        return
      }
    }

    log('DEBUG', 'Refreshing team list after save')
    await fetchTeams()
    resetForm()
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const team = teams.find(t => t.id === id)
    log('DEBUG', 'Delete requested', {
      teamId: id,
      name: team?.name ?? 'unknown',
      memberCount: team?.member_count ?? 'unknown',
    })

    if (!confirm('Delete this team? Members will be unassigned.')) {
      log('DEBUG', 'Delete cancelled by user', { teamId: id })
      return
    }

    if ((team?.member_count ?? 0) > 0) {
      log('WARN', `Deleting team "${team?.name}" which has ${team?.member_count} member(s) — they will be unassigned`)
    }

    log('INFO', 'Deleting team', { teamId: id, name: team?.name, memberCount: team?.member_count })
    setActionError(null)

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id)

      if (error) {
        // Foreign key constraint — team may still have active references
        if (error.code === '23503') {
          log('WARN', 'Foreign key constraint — team cannot be deleted while it has references', {
            teamId: id,
            name: team?.name,
            code: error.code,
            hint: error.hint,
          })
          setActionError(`Cannot delete "${team?.name}" — it still has active references. Reassign all members first.`)
        } else {
          log('ERROR', 'Failed to delete team', {
            teamId: id,
            code: error.code,
            message: error.message,
            details: error.details,
          })
          setActionError(`Failed to delete team: ${error.message}`)
        }
        return
      }

      log('INFO', 'Team deleted successfully', { teamId: id, name: team?.name })
      log('DEBUG', 'Refreshing team list after delete')
      await fetchTeams()

    } catch (err) {
      log('ERROR', 'Unexpected exception while deleting team', {
        teamId: id,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while deleting')
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = (team: Team) => {
    log('DEBUG', 'Edit initiated', {
      teamId: team.id,
      name: team.name,
      region: team.region,
      memberCount: team.member_count,
    })
    setActionError(null)
    setForm({
      name: team.name,
      description: team.description ?? '',
      region: team.region ?? 'India',
      is_active: team.is_active ?? true,
    })
    setEditingId(team.id)
    setShowModal(true)
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    log('DEBUG', 'resetForm() called', { wasEditing: editingId ?? 'none' })
    setForm({ name: '', description: '', region: 'India', is_active: true })
    setEditingId(null)
    setShowModal(false)
    setActionError(null)
  }

  if (loading) return <div className="text-center py-12">Loading teams...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
          <p className="text-sm text-gray-500 mt-1">Organize employees into teams</p>
        </div>
        <button
          onClick={() => {
            log('DEBUG', 'Add Team button clicked — opening modal')
            setActionError(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                     rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      {/* Page-level error banner */}
      {actionError && !showModal && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {actionError}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-900">No teams yet</p>
          <p className="text-sm text-gray-500 mt-1">Create your first team</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(team => (
            <div
              key={team.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{team.region ?? 'All Regions'}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(team)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(team.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {team.description && (
                <p className="text-sm text-gray-600 mb-3">{team.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>{team.member_count} members</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  team.is_active
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {team.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Team' : 'Add New Team'}
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
                  Team Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g., Engineering Team"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                  placeholder="What does this team do?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
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
                  Active team
                </label>
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
                  {editingId ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}