// types/employee.ts

export interface Employee {
  id: string
  company_id: string
  user_id: string
  employee_number: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  position: string | null
  department: string | null
  team_id: string | null
  manager_id: string | null
  employment_start_date: string
  employment_end_date: string | null
  employment_status: string
  region: string
  timezone: string
  location: string | null
  work_location: string
  profile_picture_url: string | null
  bio: string | null
  linkedin_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // joined fields
  team_name?: string
  manager_name?: string
}

export interface Team {
  id: string
  company_id: string
  name: string
  description: string | null
  manager_id: string | null
  region: string
  is_active: boolean
  created_at: string
  updated_at: string
  member_count?: number
}

export type EmployeeWithRelations = Employee & {
  team?: Team | null
  manager?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'position' | 'profile_picture_url'> | null
  reports?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'position' | 'profile_picture_url'>[]
}