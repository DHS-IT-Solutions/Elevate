// components/company/EmployeeCard.tsx
'use client'

import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import type { Employee } from '@/types/employee'
import { Mail, Phone, MapPin, Building2 } from 'lucide-react'

interface EmployeeCardProps {
  employee: Employee
  view?: 'grid' | 'list'
}

export default function EmployeeCard({ employee, view = 'grid' }: EmployeeCardProps) {
  const fullName = `${employee.first_name} ${employee.last_name}`

  const regionBadge = employee.region === 'UK'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-orange-50 text-orange-700 border-orange-200'

  if (view === 'list') {
    return (
      <Link href={`/profile/${employee.id}`}>
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 
                        flex items-center gap-4 hover:shadow-md hover:border-gray-300 
                        transition-all cursor-pointer">
          <Avatar name={fullName} imageUrl={employee.profile_picture_url} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{fullName}</p>
            <p className="text-sm text-gray-500 truncate">{employee.position ?? '—'}</p>
          </div>
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-500">
            <Mail className="w-4 h-4" />
            <span className="truncate max-w-[180px]">{employee.email}</span>
          </div>
          <div className="hidden lg:flex items-center gap-1 text-sm text-gray-500">
            <Building2 className="w-4 h-4" />
            <span>{employee.department ?? '—'}</span>
          </div>
          <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full border font-medium ${regionBadge}`}>
            {employee.region}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/profile/${employee.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 
                      flex flex-col items-center text-center gap-3
                      hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
        <div className="relative">
          <Avatar name={fullName} imageUrl={employee.profile_picture_url} size="lg" />
          <span className={`absolute -bottom-1 -right-1 text-xs px-1.5 py-0.5 
                            rounded-full border font-medium ${regionBadge}`}>
            {employee.region}
          </span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {fullName}
          </p>
          <p className="text-sm text-gray-500 mt-0.5 leading-tight">
            {employee.position ?? '—'}
          </p>
        </div>
        {employee.department && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {employee.department}
          </span>
        )}
      </div>
    </Link>
  )
}