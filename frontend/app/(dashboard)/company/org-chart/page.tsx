'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/shared/Avatar'
import { PageHeader } from '@/components/shared/PageHeader'
import Link from 'next/link'
import type { Employee } from '@/types/employee'
import {
  ChevronDown, ChevronRight,
  Users, GitBranch,
  ZoomIn, ZoomOut, Maximize2, Locate,
} from 'lucide-react'

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown) => {
  const ts = new Date().toISOString()
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  data !== undefined
    ? fn(`[${ts}] [${level}] [OrgChartPage] ${message}`, data)
    : fn(`[${ts}] [${level}] [OrgChartPage] ${message}`)
}

interface OrgNode {
  employee: Employee
  children: OrgNode[]
}

// ── Tree builder ──────────────────────────────────────────────────────────────
function buildTree(employees: Employee[]): OrgNode[] {
  const map = new Map<string, OrgNode>()
  employees.forEach(e => map.set(e.id, { employee: e, children: [] }))

  const roots: OrgNode[] = []
  const orphans: Employee[] = []
  const selfRefs: Employee[] = []

  employees.forEach(e => {
    if (e.manager_id) {
      if (e.manager_id === e.id) {
        selfRefs.push(e)
        roots.push(map.get(e.id)!)
      } else if (map.has(e.manager_id)) {
        map.get(e.manager_id)!.children.push(map.get(e.id)!)
      } else {
        orphans.push(e)
        roots.push(map.get(e.id)!)
      }
    } else {
      roots.push(map.get(e.id)!)
    }
  })

  if (selfRefs.length > 0) {
    log('WARN', 'Employees with self-referencing manager_id treated as root nodes', {
      count: selfRefs.length,
      employees: selfRefs.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })),
    })
  }
  if (orphans.length > 0) {
    log('WARN', 'Employees whose manager_id is not in the active employee list — placed at root', {
      count: orphans.length,
      hint: 'Manager may be inactive, deleted, or from a different company',
      employees: orphans.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}`, manager_id: e.manager_id })),
    })
  }

  return roots
}

// ── Depth colour system ───────────────────────────────────────────────────────
const depthStyles: Record<number, { border: string; dot: string; badge: string; glow: string }> = {
  0: { border: 'border-sky-400',     dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700',        glow: 'shadow-sky-100' },
  1: { border: 'border-violet-400',  dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700',  glow: 'shadow-violet-100' },
  2: { border: 'border-emerald-400', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700',glow: 'shadow-emerald-100' },
}
const fallback = { border: 'border-slate-300', dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600', glow: 'shadow-slate-100' }
const ds = (d: number) => depthStyles[d] ?? fallback

// ── OrgCard ───────────────────────────────────────────────────────────────────
function OrgCard({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const emp = node.employee
  const fullName = `${emp.first_name} ${emp.last_name}`
  const hasChildren = node.children.length > 0
  const style = ds(depth)

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Link href={`/profile/${emp.id}`}>
          <div className={`
            relative bg-white rounded-2xl border-[1.5px] ${style.border}
            w-44 text-center cursor-pointer overflow-hidden
            transition-all duration-200
            shadow-lg ${style.glow}
            hover:shadow-xl hover:-translate-y-0.5
          `}>
            <div className={`h-[3px] w-full ${style.dot}`} />
            <div className="px-3 pb-3 pt-3">
              <div className="flex justify-center mb-2.5">
                <div className="relative">
                  <Avatar name={fullName} imageUrl={emp.profile_picture_url} size="md" />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${style.dot}`} />
                </div>
              </div>
              <p className="text-[0.8rem] font-semibold text-slate-800 leading-snug truncate tracking-tight">
                {fullName}
              </p>
              {emp.position && (
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[0.65rem] font-medium ${style.badge} truncate max-w-full`}>
                  {emp.position}
                </span>
              )}
              {(emp as any).department && (
                <p className="text-[0.62rem] text-slate-400 mt-1 truncate">{(emp as any).department}</p>
              )}
            </div>
          </div>
        </Link>

        {hasChildren && (
          <button
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            className={`
              absolute -bottom-3.5 left-1/2 -translate-x-1/2
              w-7 h-7 rounded-full flex items-center justify-center
              ${style.dot} text-white shadow-md ring-2 ring-white
              hover:scale-110 active:scale-95 transition-all duration-150 z-10
            `}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="mt-10 relative">
          <div className="absolute left-1/2 w-px h-5 bg-slate-200 -translate-x-1/2 -top-5" />
          {node.children.length === 1 ? (
            <OrgCard node={node.children[0]} depth={depth + 1} />
          ) : (
            <div className="flex gap-8 items-start">
              <div
                className="absolute top-0 h-px bg-slate-200"
                style={{
                  left:  `calc(${100 / (node.children.length * 2)}%)`,
                  right: `calc(${100 / (node.children.length * 2)}%)`,
                }}
              />
              {node.children.map(child => (
                <div key={child.employee.id} className="relative flex flex-col items-center">
                  <div className="w-px h-5 bg-slate-200" />
                  <OrgCard node={child} depth={depth + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat badge ────────────────────────────────────────────────────────────────
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[0.62rem] text-slate-400 uppercase tracking-widest font-medium leading-none mb-0.5">{label}</p>
        <p className="text-base font-bold text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  )
}

// ── Count helpers ─────────────────────────────────────────────────────────────
function countNodes(n: OrgNode): number { return 1 + n.children.reduce((s, c) => s + countNodes(c), 0) }
function countDepth(n: OrgNode): number { return n.children.length === 0 ? 1 : 1 + Math.max(...n.children.map(countDepth)) }

// ── Constants ─────────────────────────────────────────────────────────────────
const MIN_SCALE = 0.1
const MAX_SCALE = 2.5
const ZOOM_STEP = 0.15

// ── ZoomCanvas ────────────────────────────────────────────────────────────────
function ZoomCanvas({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  // Use a ref for transform state so pan/wheel don't trigger re-renders
  const t = useRef({ scale: 1, tx: 0, ty: 0, dragging: false, startX: 0, startY: 0 })
  const [displayScale, setDisplayScale] = useState(1)
  const lastTouchRef = useRef<{ x: number; y: number; dist?: number } | null>(null)

  const apply = useCallback(() => {
    if (!innerRef.current) return
    const { scale, tx, ty } = t.current
    innerRef.current.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`
  }, [])

  // Auto-fit on mount
  useEffect(() => {
    const id = setTimeout(() => {
      const outer = outerRef.current
      const inner = innerRef.current
      if (!outer || !inner) return
      const ow = outer.clientWidth
      const oh = outer.clientHeight
      const iw = inner.scrollWidth
      const ih = inner.scrollHeight
      const sc = Math.min(ow / (iw + 120), oh / (ih + 120), 1)
      t.current.scale = sc
      t.current.tx = (ow - iw * sc) / 2
      t.current.ty = Math.max(40, (oh - ih * sc) / 2)
      setDisplayScale(sc)
      apply()
    }, 150)
    return () => clearTimeout(id)
  }, [apply])

  // Mouse-wheel zoom centred on pointer
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect  = el.getBoundingClientRect()
      const mx    = e.clientX - rect.left
      const my    = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1 : -1
      const next  = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.current.scale * (1 + delta * 0.1)))
      const ratio = next / t.current.scale
      t.current.tx    = mx - ratio * (mx - t.current.tx)
      t.current.ty    = my - ratio * (my - t.current.ty)
      t.current.scale = next
      setDisplayScale(next)
      apply()
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [apply])

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    t.current.dragging = true
    t.current.startX   = e.clientX - t.current.tx
    t.current.startY   = e.clientY - t.current.ty
    if (outerRef.current) outerRef.current.style.cursor = 'grabbing'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!t.current.dragging) return
    t.current.tx = e.clientX - t.current.startX
    t.current.ty = e.clientY - t.current.startY
    apply()
  }, [apply])

  const stopDrag = useCallback(() => {
    t.current.dragging = false
    if (outerRef.current) outerRef.current.style.cursor = 'grab'
  }, [])

  // Touch pan + pinch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchRef.current = { x: 0, y: 0, dist: Math.hypot(dx, dy) }
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const last = lastTouchRef.current
    if (!last) return
    if (e.touches.length === 1 && last.dist === undefined) {
      t.current.tx += e.touches[0].clientX - last.x
      t.current.ty += e.touches[0].clientY - last.y
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      apply()
    } else if (e.touches.length === 2 && last.dist !== undefined) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.current.scale * (dist / last.dist)))
      const cx   = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy   = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = outerRef.current!.getBoundingClientRect()
      const mx   = cx - rect.left
      const my   = cy - rect.top
      const ratio = next / t.current.scale
      t.current.tx    = mx - ratio * (mx - t.current.tx)
      t.current.ty    = my - ratio * (my - t.current.ty)
      t.current.scale = next
      lastTouchRef.current = { x: 0, y: 0, dist }
      setDisplayScale(next)
      apply()
    }
  }, [apply])

  // Button zoom (centred on viewport)
  const zoom = useCallback((dir: 1 | -1) => {
    const outer = outerRef.current
    if (!outer) return
    const cx   = outer.clientWidth / 2
    const cy   = outer.clientHeight / 2
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.current.scale + dir * ZOOM_STEP))
    const ratio = next / t.current.scale
    t.current.tx    = cx - ratio * (cx - t.current.tx)
    t.current.ty    = cy - ratio * (cy - t.current.ty)
    t.current.scale = next
    setDisplayScale(next)
    apply()
  }, [apply])

  // Fit to screen
  const fit = useCallback(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const ow = outer.clientWidth
    const oh = outer.clientHeight
    // measure content at scale=1
    const iw = inner.scrollWidth  / t.current.scale
    const ih = inner.scrollHeight / t.current.scale
    const sc = Math.min(ow / (iw + 120), oh / (ih + 120), 1)
    t.current.scale = sc
    t.current.tx    = (ow - iw * sc) / 2
    t.current.ty    = Math.max(40, (oh - ih * sc) / 2)
    setDisplayScale(sc)
    apply()
  }, [apply])

  return (
    <div className="relative flex-1 overflow-hidden"
      style={{
        background: '#F1F5F9',
        backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Draggable canvas */}
      <div
        ref={outerRef}
        className="absolute inset-0"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { lastTouchRef.current = null }}
      >
        <div
          ref={innerRef}
          className="absolute top-0 left-0 origin-top-left p-20 flex gap-20 justify-center"
          style={{ willChange: 'transform' }}
        >
          {children}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 select-none">
        <button
          onClick={() => zoom(1)}
          title="Zoom in"
          className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:border-sky-300 transition-all"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-9 h-7 bg-white/90 backdrop-blur-sm rounded-lg shadow border border-slate-200 flex items-center justify-center">
          <span className="text-[0.6rem] font-bold text-slate-400 tabular-nums">
            {Math.round(displayScale * 100)}%
          </span>
        </div>

        <button
          onClick={() => zoom(-1)}
          title="Zoom out"
          className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow border border-slate-200 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:border-sky-300 transition-all"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="h-px bg-slate-200 my-0.5" />

        <button
          onClick={fit}
          title="Fit to screen"
          className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow border border-slate-200 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={fit}
          title="Re-centre"
          className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow border border-slate-200 flex items-center justify-center text-slate-500 hover:text-violet-600 hover:border-violet-300 transition-all"
        >
          <Locate className="w-4 h-4" />
        </button>
      </div>

      {/* ── Hint ── */}
      <div className="absolute bottom-6 left-6 z-20 select-none pointer-events-none">
        <div className="bg-white/75 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <p className="text-[0.65rem] text-slate-400">
            Scroll to zoom · Drag to pan · Pinch on touch
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OrgChartPage() {
  const [tree, setTree]             = useState<OrgNode[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    log('DEBUG', 'OrgChartPage mounted — fetching employees')

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('is_active', true)
          .order('first_name')

        if (error) {
          log('ERROR', 'Failed to fetch employees for org chart', {
            code: error.code, message: error.message, details: error.details,
          })
          setFetchError(`Failed to load org chart: ${error.message}`)
          setLoading(false)
          return
        }

        const employees = (data as Employee[]) ?? []
        log('INFO', `Fetched ${employees.length} active employee(s)`)

        if (employees.length === 0) {
          log('DEBUG', 'No active employees found — org chart will be empty')
          setTree([])
          setLoading(false)
          return
        }

        const ids = new Set(employees.map(e => e.id))
        const withInvalidManager = employees.filter(
          e => e.manager_id && e.manager_id !== e.id && !ids.has(e.manager_id)
        )
        if (withInvalidManager.length > 0) {
          log('WARN', `${withInvalidManager.length} employee(s) reference a manager_id outside active employees`, {
            hint: 'These will appear as additional root nodes in the org chart',
          })
        }

        log('DEBUG', 'Building org tree')
        const nodes = buildTree(employees)

        const countLocal = (n: OrgNode): number => 1 + n.children.reduce((s, c) => s + countLocal(c), 0)
        const totalInTree = nodes.reduce((sum, r) => sum + countLocal(r), 0)

        log('INFO', 'Org tree built', {
          rootCount: nodes.length,
          totalInTree,
          roots: nodes.map(r => ({
            name: `${r.employee.first_name} ${r.employee.last_name}`,
            children: r.children.length,
          })),
        })

        if (totalInTree !== employees.length) {
          log('WARN', 'Tree node count does not match employee count — some employees may be missing', {
            employeeCount: employees.length,
            treeCount: totalInTree,
            difference: employees.length - totalInTree,
            hint: 'Likely a circular manager_id reference',
          })
        }

        setTree(nodes)
      } catch (err) {
        log('ERROR', 'Unexpected exception in OrgChartPage fetch()', {
          error: err instanceof Error ? err.message : String(err),
        })
        setFetchError('An unexpected error occurred while loading the org chart')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  const totalEmployees = tree.reduce((sum, r) => sum + countNodes(r), 0)
  const maxDepth       = tree.length > 0 ? Math.max(...tree.map(countDepth)) : 0

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-slate-100" />
        <div className="absolute inset-0 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-slate-400 tracking-wide">Building organisation chart…</p>
    </div>
  )

  if (fetchError) return (
    <div className="h-screen flex flex-col bg-[#F8FAFC]">
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <PageHeader title="Organisation Chart" subtitle="Visual hierarchy of your company" />
      </div>
      <div className="m-8">
        <div className="flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
          <span className="mt-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shrink-0 font-bold">!</span>
          {fetchError}
        </div>
      </div>
    </div>
  )

  if (tree.length === 0) return (
    <div className="h-screen flex flex-col bg-[#F8FAFC]">
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <PageHeader title="Organisation Chart" subtitle="Visual hierarchy of your company" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <GitBranch className="w-6 h-6 text-slate-400" />
        </div>
        <p className="font-semibold text-slate-600">No org chart data yet</p>
        <p className="text-sm text-slate-400">Add employees and assign managers to build the tree</p>
      </div>
    </div>
  )

  return (
    // Lock viewport — no page-level scroll at all
    <div className="h-screen flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-8 py-5 flex items-center gap-6 z-10">
        <div className="flex-1">
          <PageHeader title="Organisation Chart" subtitle="Visual hierarchy of your company" />
        </div>

        <div className="flex items-center gap-3">
          <Stat icon={<Users className="w-3.5 h-3.5 text-sky-600" />}        label="Members" value={totalEmployees} />
          <Stat icon={<GitBranch className="w-3.5 h-3.5 text-violet-600" />} label="Levels"  value={maxDepth} />
        </div>

        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
          {[
            { label: 'Executive',  color: 'bg-sky-500' },
            { label: 'Manager',    color: 'bg-violet-500' },
            { label: 'Individual', color: 'bg-emerald-500' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zoomable / pannable infinite canvas ── */}
      <ZoomCanvas>
        {tree.map(root => (
          <OrgCard key={root.employee.id} node={root} depth={0} />
        ))}
      </ZoomCanvas>
    </div>
  )
}