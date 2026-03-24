// app/(dashboard)/announcements/page.tsx
'use client'
import { usePermission, PERMISSIONS } from '@/lib/rbac/hooks'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import { Plus, Pin, Calendar, Edit2, Trash2 } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [AnnouncementsPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [AnnouncementsPage] ${message}`)
}

interface Announcement {
  id: string
  title: string
  content: string
  priority: string | null
  is_pinned: boolean | null
  published_at: string | null
  created_by: string | null
  created_at: string | null
  creator?: {
    first_name: string
    last_name: string
    profile_picture_url: string | null
  }
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading]             = useState(true)
  const [showModal, setShowModal]         = useState(false)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [actionError, setActionError]     = useState<string | null>(null)
  const supabase = createClient()
  const { hasPermission: isAdmin } = usePermission(PERMISSIONS.ANNOUNCEMENTS.CREATE)

  const [form, setForm] = useState({
    title:     '',
    content:   '',
    priority:  'normal',
    is_pinned: false,
  })

  useEffect(() => {
    log('DEBUG', 'AnnouncementsPage mounted')
    fetchAnnouncements()
  }, [])


  // ── Fetch announcements ─────────────────────────────────────────────────────
  const fetchAnnouncements = async () => {
    log('DEBUG', 'fetchAnnouncements() called')
    setActionError(null)

    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          creator:employees!announcements_created_by_fkey(first_name, last_name, profile_picture_url)
        `)
        .order('is_pinned',    { ascending: false })
        .order('published_at', { ascending: false })

      if (error) {
        log('ERROR', 'Failed to fetch announcements', {
          code:    error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to load announcements: ${error.message}`)
        setAnnouncements([])
      } else {
        const pinned   = (data ?? []).filter((a: any) => a.is_pinned).length
        const unpinned = (data ?? []).length - pinned

        log('INFO', `Loaded ${data?.length ?? 0} announcement(s)`, {
          pinned,
          unpinned,
          withCreator: (data ?? []).filter((a: any) => a.creator).length,
          withoutCreator: (data ?? []).filter((a: any) => !a.creator).length,
        })

        if ((data ?? []).some((a: any) => !a.creator)) {
          log('WARN', 'Some announcements have no joined creator data', {
            hint: 'The created_by foreign key may be null or point to a deleted employee',
            affected: (data ?? [])
              .filter((a: any) => !a.creator)
              .map((a: any) => ({ id: a.id, title: a.title })),
          })
        }

        setAnnouncements((data as any) ?? [])
      }
    } catch (err) {
      log('ERROR', 'Unexpected exception in fetchAnnouncements()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while loading announcements')
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  // ── Create / Update ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError(null)

    try {
      // ── Resolve author ──────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        log('WARN', 'handleSubmit() — no authenticated user', {
          authError: authError?.message ?? 'user is null',
        })
        setActionError('You must be logged in to post announcements')
        return
      }

      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (empError || !emp) {
        log('ERROR', 'Failed to resolve employee for announcement author', {
          userId: user.id,
          code: empError?.code,
          message: empError?.message,
        })
        setActionError('Could not identify your employee record')
        return
      }

      if (editingId) {
        // ── Update ────────────────────────────────────────────────────────────
        const existing = announcements.find(a => a.id === editingId)
        log('INFO', 'Updating announcement', {
          announcementId: editingId,
          changes: {
            title:     form.title     !== existing?.title     ? `changed` : '(unchanged)',
            priority:  form.priority  !== existing?.priority  ? `"${existing?.priority}" → "${form.priority}"` : '(unchanged)',
            is_pinned: form.is_pinned !== existing?.is_pinned ? `${existing?.is_pinned} → ${form.is_pinned}` : '(unchanged)',
          },
        })

        const { error: updateError } = await supabase
          .from('announcements')
          .update(form)
          .eq('id', editingId)

        if (updateError) {
          log('ERROR', 'Failed to update announcement', {
            announcementId: editingId,
            code:    updateError.code,
            message: updateError.message,
            details: updateError.details,
          })
          setActionError(`Failed to update: ${updateError.message}`)
          return
        }

        log('INFO', 'Announcement updated successfully', {
          announcementId: editingId,
          title: form.title,
        })

      } else {
        // ── Create ────────────────────────────────────────────────────────────
        const publishedAt = new Date().toISOString()
        log('INFO', 'Creating new announcement', {
          title:       form.title,
          priority:    form.priority,
          is_pinned:   form.is_pinned,
          publishedAt,
          authorId:    emp.id,
        })

        const { data: inserted, error: insertError } = await supabase
          .from('announcements')
          .insert({
            ...form,
            created_by:   emp.id,
            published_at: publishedAt,
          })
          .select()

        if (insertError) {
          log('ERROR', 'Failed to create announcement', {
            code:    insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint:    insertError.hint,
          })
          setActionError(`Failed to publish: ${insertError.message}`)
          return
        }

        log('INFO', 'Announcement created successfully', {
          newId:    inserted?.[0]?.id ?? 'unknown',
          title:    form.title,
          priority: form.priority,
          pinned:   form.is_pinned,
        })
      }

      log('DEBUG', 'Refreshing announcement list after save')
      await fetchAnnouncements()
      resetForm()

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleSubmit()', {
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred')
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const announcement = announcements.find(a => a.id === id)
    log('DEBUG', 'Delete requested', {
      announcementId: id,
      title:    announcement?.title ?? 'unknown',
      is_pinned: announcement?.is_pinned,
    })

    if (!confirm('Delete this announcement?')) {
      log('DEBUG', 'Delete cancelled by user', { announcementId: id })
      return
    }

    log('INFO', 'Deleting announcement', {
      announcementId: id,
      title: announcement?.title,
    })
    setActionError(null)

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) {
        log('ERROR', 'Failed to delete announcement', {
          announcementId: id,
          code:    error.code,
          message: error.message,
          details: error.details,
        })
        setActionError(`Failed to delete: ${error.message}`)
        return
      }

      log('INFO', 'Announcement deleted successfully', {
        announcementId: id,
        title: announcement?.title,
      })

      log('DEBUG', 'Refreshing announcement list after delete')
      await fetchAnnouncements()

    } catch (err) {
      log('ERROR', 'Unexpected exception in handleDelete()', {
        announcementId: id,
        error: err instanceof Error ? err.message : String(err),
      })
      setActionError('An unexpected error occurred while deleting')
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = (announcement: Announcement) => {
    log('DEBUG', 'Edit initiated', {
      announcementId: announcement.id,
      title:     announcement.title,
      priority:  announcement.priority,
      is_pinned: announcement.is_pinned,
    })
    setActionError(null)
    setForm({
      title:     announcement.title,
      content:   announcement.content,
      priority:  announcement.priority  ?? 'normal',
      is_pinned: announcement.is_pinned ?? false,
    })
    setEditingId(announcement.id)
    setShowModal(true)
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    log('DEBUG', 'resetForm() called', { wasEditing: editingId ?? 'none' })
    setForm({ title: '', content: '', priority: 'normal', is_pinned: false })
    setEditingId(null)
    setShowModal(false)
    setActionError(null)
  }

  if (loading) {
    return <div className="text-center py-20">Loading announcements...</div>
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Company-wide updates and news"
        action={
          isAdmin ? (
            <button
              onClick={() => {
                log('DEBUG', 'New Announcement button clicked')
                setActionError(null)
                setShowModal(true)
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 
                         rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </button>
          ) : undefined
        }
      />

      {/* Page-level error banner */}
      {actionError && !showModal && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {actionError}
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(announcement => {
            const creatorName = announcement.creator
              ? `${announcement.creator.first_name} ${announcement.creator.last_name}`
              : 'Unknown'

            const priorityColor = {
              high:   'bg-red-50 text-red-700 border-red-200',
              normal: 'bg-blue-50 text-blue-700 border-blue-200',
              low:    'bg-gray-50 text-gray-700 border-gray-200',
            }[announcement.priority ?? 'normal'] ?? 'bg-gray-50 text-gray-700 border-gray-200'

            return (
              <div
                key={announcement.id}
                className={`bg-white border rounded-xl p-6 ${
                  announcement.is_pinned ? 'border-amber-300 shadow-md' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {announcement.is_pinned && (
                        <Pin className="w-4 h-4 text-amber-600" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {announcement.title}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${priorityColor}`}>
                        {announcement.priority}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1 ml-4">
                      <button
                        onClick={() => handleEdit(announcement)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={creatorName}
                      imageUrl={announcement.creator?.profile_picture_url}
                      size="sm"
                    />
                    <span>{creatorName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {announcement.published_at
                      ? new Date(announcement.published_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : 'Draft'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h3>

            {/* Modal-level error banner */}
            {actionError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g., Office Closure for Christmas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content *
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                  placeholder="Write your announcement here..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={e => {
                      log('DEBUG', 'Priority changed', { value: e.target.value })
                      setForm(f => ({ ...f, priority: e.target.value }))
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_pinned}
                      onChange={e => {
                        log('DEBUG', 'is_pinned toggled', { value: e.target.checked })
                        setForm(f => ({ ...f, is_pinned: e.target.checked }))
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    Pin to top
                  </label>
                </div>
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
                  {editingId ? 'Save Changes' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}