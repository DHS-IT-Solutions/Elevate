// types/leave.ts

export interface Leave {
  id: string
  employee_id: string | null
  leave_policy_id: string | null
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  is_half_day: boolean | null
  half_day_period: string | null
  reason: string | null
  status: string | null
  approver_id: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export interface LeaveWithEmployee extends Leave {
  employee?: {
    id: string
    first_name: string
    last_name: string
    position: string | null
    profile_picture_url: string | null
    email: string
  }
  approver?: {
    id: string
    first_name: string
    last_name: string
  }
}

export interface LeaveBalance {
  id: string
  employee_id: string | null
  leave_policy_id: string | null
  year: number
  total_allocated: number
  used: number | null
  remaining: number | null
  carried_forward: number | null
  created_at: string | null
  updated_at: string | null
}

export interface LeavePolicy {
  id: string
  company_id: string | null
  name: string
  leave_type: string
  annual_quota: number | null
  carry_forward_allowed: boolean | null
  max_carry_forward: number | null
  requires_approval: boolean | null
  region: string | null
  description: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type LeaveType = 'annual_leave' | 'sick_leave' | 'work_from_home' | 'unpaid_leave' | 'other'