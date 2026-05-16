import 'server-only'

import type { ClinicHourRecord } from '@/lib/clinics/hours'
import { hasConfirmedOpeningHours } from '@/lib/clinics/hours'
import { isValidTimezone } from '@/lib/clinics/validation'

export interface ReadinessClinicShape {
  phone: string | null
  address: string | null
  emergency_instructions: string | null
  timezone: string
}

export interface ClinicReadiness {
  can_go_live: boolean
  missing: string[]
}

export function getClinicReadiness(args: {
  clinic: ReadinessClinicShape
  hours: ClinicHourRecord[]
  activeServicesCount: number
}) {
  const missing: string[] = []

  if (!args.clinic.phone?.trim()) missing.push('phone')
  if (!args.clinic.address?.trim()) missing.push('address')
  if (!isValidTimezone(args.clinic.timezone)) missing.push('timezone')
  if (!args.clinic.emergency_instructions?.trim()) missing.push('emergency_instructions')
  if (!hasConfirmedOpeningHours(args.hours)) missing.push('opening_hours')
  if (args.activeServicesCount < 1) missing.push('services')

  return {
    can_go_live: missing.length === 0,
    missing,
  } satisfies ClinicReadiness
}
