import 'server-only'

import { z } from 'zod'
import { isValidTimezone } from '@/lib/clinics/validation'
export type { AccountProfileRow } from '@/lib/account-profile-types'

export const accountProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(80).optional(),
  timezone: z.string().trim().refine(isValidTimezone, 'Select a valid timezone.').optional(),
})

export type AccountProfileUpdateInput = z.infer<typeof accountProfileUpdateSchema>

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeAccountProfileUpdate(input: AccountProfileUpdateInput) {
  const output: Record<string, string> = {}

  if (input.full_name !== undefined) {
    output.full_name = normalizeWhitespace(input.full_name)
  }

  if (input.timezone !== undefined) {
    output.timezone = input.timezone.trim()
  }

  return output
}
