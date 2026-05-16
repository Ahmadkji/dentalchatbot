import 'server-only'

import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const httpsUrlPattern = /^https:\/\/[^/\s?#]+(?:[^\s]*)?$/i

/** Allowed domain must be an exact HTTPS origin (e.g. https://example.com). */
const allowedDomainPattern = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(:\d+)?$/i

/**
 * Normalize a domain input to an exact HTTPS origin.
 * Strips path, query, hash, and trailing slashes.
 * Returns null if the input is not a valid HTTPS origin.
 */
export function normalizeAllowedDomain(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  let url: URL
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    url = new URL(withProtocol)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null

  const origin = url.origin
  if (!allowedDomainPattern.test(origin)) return null

  return origin
}

/**
 * Normalize an array of allowed domain strings.
 * Filters out empty/invalid entries and deduplicates.
 */
export function normalizeAllowedDomains(domains: string[]): string[] {
  const normalized = domains
    .map((d) => normalizeAllowedDomain(d))
    .filter((d): d is string => d !== null)
  return [...new Set(normalized)]
}

/**
 * Validate that a browser Origin header matches an allowed domain.
 * Both must be exact HTTPS origin strings.
 */
export function isOriginAllowed(origin: string, allowedDomains: string[]): boolean {
  if (!origin || !allowedDomains.length) return false
  return allowedDomains.includes(origin)
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function ensureHttpsUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProtocol)

  if (url.protocol !== 'https:' || !url.hostname.includes('.')) {
    throw new Error('URL must use https:// and include a valid domain.')
  }

  url.hash = ''
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '') || url.origin
}

export function isValidTimezone(value: string) {
  if (!value) return false

  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone').includes(value)
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalizedInput = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed
  const phone = parsePhoneNumberFromString(normalizedInput)

  if (!phone?.isValid()) {
    throw new Error('Phone must be a valid international number in E.164 format, for example +923001234567.')
  }

  return phone.number
}

export function normalizeOptionalPhoneNumber(value: string | null | undefined) {
  if (!value || !value.trim()) return null
  return normalizePhoneNumber(value)
}

export function normalizeOptionalHttpsUrl(value: string | null | undefined) {
  if (!value || !value.trim()) return null
  return ensureHttpsUrl(value)
}

export const clinicProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().regex(slugPattern, 'Slug must contain only lowercase letters, numbers, and hyphens.').optional(),
  country: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().max(240).optional(),
  timezone: z.string().trim().refine(isValidTimezone, 'Select a valid timezone.').optional(),
  phone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional().nullable(),
  website_url: z.string().trim().optional().nullable(),
  map_link: z.string().trim().optional().nullable(),
  pricing_notes: z.string().trim().max(1200).optional().nullable(),
  appointment_rules: z.string().trim().max(1200).optional().nullable(),
  emergency_instructions: z.string().trim().max(1200).optional().nullable(),
})

export type ClinicProfileUpdateInput = z.infer<typeof clinicProfileUpdateSchema>

export function normalizeClinicProfileUpdate(input: ClinicProfileUpdateInput) {
  const output: Record<string, string | null> = {}

  if (input.name !== undefined) output.name = normalizeWhitespace(input.name)
  if (input.slug !== undefined) output.slug = input.slug.trim()
  if (input.country !== undefined) output.country = normalizeWhitespace(input.country)
  if (input.city !== undefined) output.city = normalizeWhitespace(input.city)
  if (input.address !== undefined) output.address = normalizeWhitespace(input.address)
  if (input.timezone !== undefined) output.timezone = input.timezone.trim()
  if (input.phone !== undefined) output.phone = normalizePhoneNumber(input.phone)
  if (input.whatsapp !== undefined) output.whatsapp = normalizeOptionalPhoneNumber(input.whatsapp)
  if (input.website_url !== undefined) output.website_url = normalizeOptionalHttpsUrl(input.website_url)
  if (input.map_link !== undefined) output.map_link = normalizeOptionalHttpsUrl(input.map_link)
  if (input.pricing_notes !== undefined) output.pricing_notes = input.pricing_notes ? normalizeWhitespace(input.pricing_notes) : null
  if (input.appointment_rules !== undefined) output.appointment_rules = input.appointment_rules ? normalizeWhitespace(input.appointment_rules) : null
  if (input.emergency_instructions !== undefined) output.emergency_instructions = input.emergency_instructions ? normalizeWhitespace(input.emergency_instructions) : null

  return output
}

const numericField = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return value
}, z.number().finite())

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(2, 'Service name is required.').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  price_amount: numericField.nullable().refine((value) => value === null || value >= 0, 'Price cannot be negative.').optional(),
  price_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code.').optional().nullable(),
  pricing_note: z.string().trim().max(400).optional().nullable(),
  duration_minutes: numericField.refine((value) => value > 0, 'Duration must be greater than 0.'),
  is_active: z.boolean().optional(),
  sort_order: numericField.refine((value) => value > 0, 'Sort order must be greater than 0.').optional(),
})

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>

export function normalizeServiceInput(input: ServiceCreateInput) {
  return {
    name: normalizeWhitespace(input.name),
    description: input.description ? normalizeWhitespace(input.description) : null,
    category: input.category ? normalizeWhitespace(input.category) : null,
    price_amount: input.price_amount ?? null,
    price_currency: input.price_currency?.trim().toUpperCase() ?? null,
    pricing_note: input.pricing_note ? normalizeWhitespace(input.pricing_note) : null,
    duration_minutes: Number(input.duration_minutes),
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ? Number(input.sort_order) : 100,
  }
}
