export interface AccountProfileRow {
  id: string
  email: string
  full_name: string | null
  timezone: string
  onboarding_completed: boolean
  default_clinic_id: string | null
  created_at?: string | null
  updated_at?: string | null
}
