// components/company/DirectoryFilters.tsx
'use client'

import { Search, LayoutGrid, List, SlidersHorizontal } from 'lucide-react'

interface Filters {
  search: string
  region: string
  department: string
  team: string
  status: string
}

interface DirectoryFiltersProps {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  view: 'grid' | 'list'
  onViewChange: (v: 'grid' | 'list') => void
  totalCount: number
  departments: string[]
  teams: string[]
}

export default function DirectoryFilters({
  filters, onChange, view, onViewChange, totalCount, departments, teams
}: DirectoryFiltersProps) {
  return (
    <div className="space-y-3 mb-6">
      {/* Search + View toggle row */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter dropdowns */}
        <select
          value={filters.region}
          onChange={e => onChange({ region: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
        >
          <option value="">All Regions</option>
          <option value="India">India</option>
          <option value="UK">UK</option>
        </select>

        <select
          value={filters.department}
          onChange={e => onChange({ department: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={e => onChange({ status: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* View toggle */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => onViewChange('grid')}
            className={`p-2 ${view === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`p-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {totalCount} {totalCount === 1 ? 'employee' : 'employees'}
      </p>
    </div>
  )
}