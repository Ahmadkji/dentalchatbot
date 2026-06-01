import { z } from 'zod'

export const leadStatusValues = ['new', 'contacted', 'booked', 'closed', 'spam'] as const
export type LeadStatus = (typeof leadStatusValues)[number]

export const leadPreferredContactValues = ['phone', 'email', 'text'] as const
export type LeadPreferredContact = (typeof leadPreferredContactValues)[number]

export const leadStatusSchema = z.enum(leadStatusValues)
export const leadPreferredContactSchema = z.enum(leadPreferredContactValues)

const leadDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format.')
const leadTimeSchema = z
  .string()
  .trim()
  .regex(/^(?:[01]?\d|2[0-3]):[0-5]\d$/, 'Invalid time format.')
const leadEmailSchema = z.string().trim().email('Invalid email address.').max(254)

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const optionalTextField = (max: number) =>
  z.string().trim().max(max).optional().nullable()

export const leadCreateSchema = z
  .object({
    conversationId: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(2, 'Lead name is required.').max(160),
    phone: z.string().trim().min(7, 'Phone must be at least 7 characters.').max(40).optional().nullable(),
    email: leadEmailSchema.optional().nullable(),
    question: z.string().trim().min(1, 'Question is required.').max(1000),
    service: optionalTextField(200),
    preferredDate: leadDateSchema.optional().nullable(),
    preferredTime: leadTimeSchema.optional().nullable(),
    message: optionalTextField(5000),
    internalNote: optionalTextField(5000),
    preferredContact: leadPreferredContactSchema.optional(),
    source: z.string().trim().max(50).optional(),
    status: leadStatusSchema.optional(),
  })
  .refine((input) => {
    const phone = normalizeNullableText(input.phone)
    const email = normalizeNullableText(input.email)
    return Boolean(phone || email)
  }, {
    message: 'Either phone or email is required.',
    path: ['phone'],
  })
  .transform((input) => ({
    conversationId: input.conversationId ?? null,
    name: input.name.trim(),
    phone: normalizeNullableText(input.phone),
    email: normalizeNullableText(input.email)?.toLowerCase() ?? null,
    question: input.question.trim(),
    service: normalizeNullableText(input.service),
    preferredDate: normalizeNullableText(input.preferredDate),
    preferredTime: normalizeNullableText(input.preferredTime),
    message: normalizeNullableText(input.message),
    internalNote: normalizeNullableText(input.internalNote),
    preferredContact: input.preferredContact ?? 'phone',
    source: input.source?.trim() || 'chatbot',
    status: input.status ?? 'new',
  }))

export type LeadCreateInput = z.infer<typeof leadCreateSchema>

export const leadPatchSchema = z
  .object({
    status: leadStatusSchema.optional(),
    name: z.string().trim().min(2, 'Lead name is required.').max(160).optional(),
    phone: z.string().trim().min(7, 'Phone must be at least 7 characters.').max(40).optional().nullable(),
    email: leadEmailSchema.optional().nullable(),
    question: z.string().trim().min(1, 'Question is required.').max(1000).optional(),
    preferredContact: leadPreferredContactSchema.optional(),
    service: optionalTextField(200),
    preferredDate: leadDateSchema.optional().nullable(),
    preferredTime: leadTimeSchema.optional().nullable(),
    message: optionalTextField(5000),
    internalNote: optionalTextField(5000),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one lead field is required.',
  })
  .transform((input) => {
    const update: Record<string, unknown> = {}

    if (input.status !== undefined) update.status = input.status
    if (input.name !== undefined) update.name = input.name.trim()
    if (input.phone !== undefined) update.phone = normalizeNullableText(input.phone)
    if (input.email !== undefined) update.email = normalizeNullableText(input.email)?.toLowerCase() ?? null
    if (input.question !== undefined) update.question = input.question.trim()
    if (input.preferredContact !== undefined) update.preferred_contact = input.preferredContact
    if (input.service !== undefined) update.service = normalizeNullableText(input.service)
    if (input.preferredDate !== undefined) update.preferred_date = normalizeNullableText(input.preferredDate)
    if (input.preferredTime !== undefined) update.preferred_time = normalizeNullableText(input.preferredTime)
    if (input.message !== undefined) update.message = normalizeNullableText(input.message)
    if (input.internalNote !== undefined) update.internal_note = normalizeNullableText(input.internalNote)

    return update
  })

export type LeadPatchInput = z.infer<typeof leadPatchSchema>

const leadRowSchema = z.object({
  id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  question: z.string(),
  service: z.string().nullable().optional(),
  preferred_date: z.string().nullable().optional(),
  preferred_time: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  internal_note: z.string().nullable().optional(),
  preferred_contact: z.string().trim().min(1).max(20),
  status: leadStatusSchema,
  source: z.string(),
  closed_reason: z.string().nullable().optional(),
  last_contacted_at: z.string().nullable().optional(),
  automation_key: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export interface LeadRecord {
  id: string
  conversationId: string | null
  name: string
  phone: string | null
  email: string | null
  question: string
  service: string | null
  preferredDate: string | null
  preferredTime: string | null
  message: string | null
  internalNote: string | null
  preferredContact: LeadPreferredContact
  status: LeadStatus
  source: string
  closedReason: string | null
  lastContactedAt: string | null
  createdAt: string
  updatedAt: string
}

export function mapLeadRow(row: unknown): LeadRecord {
  const parsed = leadRowSchema.parse(row)

  return {
    id: parsed.id,
    conversationId: parsed.conversation_id ?? null,
    name: parsed.name,
    phone: parsed.phone ?? null,
    email: parsed.email ?? null,
    question: parsed.question,
    service: parsed.service ?? null,
    preferredDate: parsed.preferred_date ?? null,
    preferredTime: parsed.preferred_time ?? null,
    message: parsed.message ?? null,
    internalNote: parsed.internal_note ?? null,
    preferredContact:
      parsed.preferred_contact === 'email' || parsed.preferred_contact === 'text'
        ? parsed.preferred_contact
        : 'phone',
    status: parsed.status,
    source: parsed.source,
    closedReason: parsed.closed_reason ?? null,
    lastContactedAt: parsed.last_contacted_at ?? null,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  }
}

export function mapLeadRows(rows: unknown[]): LeadRecord[] {
  return rows.map((row) => mapLeadRow(row))
}

export function getLeadConflictMessage(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
  if (code !== '23505') return null

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : ''
  const details =
    error && typeof error === 'object' && 'details' in error
      ? String((error as { details?: unknown }).details ?? '')
      : ''
  const combined = `${message} ${details}`

  if (
    combined.includes('Duplicate lead phone') ||
    combined.includes('idx_leads_clinic_phone_active_unique')
  ) {
    return 'A lead with this phone already exists.'
  }

  if (
    combined.includes('Duplicate lead email') ||
    combined.includes('idx_leads_clinic_email_active_unique')
  ) {
    return 'A lead with this email already exists.'
  }

  return 'A matching active lead already exists.'
}

const leadListQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(1000),
})

export type LeadListQuery = z.infer<typeof leadListQuerySchema>

export function parseLeadListQuery(input: Record<string, string | null | undefined>): LeadListQuery {
  return leadListQuerySchema.parse({
    ...input,
    status: input.status ?? undefined,
    page: input.page ?? undefined,
    pageSize: input.pageSize ?? undefined,
  })
}
