/**
 * Shared Zod validation schemas for public widget API routes.
 * These schemas enforce input format before any database interaction,
 * preventing malformed data from reaching Supabase queries.
 *
 * Token format: randomBytes(32).toString('hex') = 64 hex chars
 * Conversation ID: UUID v4 (from Supabase gen_random_uuid)
 * Clinic ID: UUID v4
 */

import { z } from 'zod'

/** Maximum serialized size of analytics metadata (1 KB). */
const MAX_METADATA_BYTES = 1024

/** Maximum number of top-level keys in metadata. */
const MAX_METADATA_KEYS = 20

/**
 * Sanitize and cap analytics metadata before DB storage.
 * Rejects payloads that are too large or have too many keys.
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(metadata)
  if (keys.length > MAX_METADATA_KEYS) {
    throw new Error(`Metadata exceeds maximum of ${MAX_METADATA_KEYS} keys`)
  }

  const serialized = JSON.stringify(metadata)
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new Error(`Metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes`)
  }

  return metadata
}

const metadataSchema = z
  .record(z.string().max(64), z.unknown())
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val) return true
      return Object.keys(val).length <= MAX_METADATA_KEYS
    },
    { message: `Metadata exceeds maximum of ${MAX_METADATA_KEYS} keys` },
  )
  .refine(
    (val) => {
      if (!val) return true
      return JSON.stringify(val).length <= MAX_METADATA_BYTES
    },
    { message: `Metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes` },
  )

export const widgetAccessTokenSchema = z
  .string()
  .min(1, 'Widget access token is required')
  .max(2048, 'Widget access token too long')

/** Clinic slug — lowercase alphanumeric with hyphens */
export const clinicSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')

/** Visitor ID — non-empty string */
export const visitorIdSchema = z
  .string()
  .min(1, 'Visitor ID is required')
  .max(128, 'Visitor ID too long')

/** Exactly 64 lowercase hex characters (output of randomBytes(32).toString('hex')) */
export const publicSessionTokenSchema = z
  .string()
  .length(64, 'Token must be exactly 64 hex characters')
  .regex(/^[0-9a-f]+$/, 'Token must be lowercase hex')

/** UUID v4 format */
export const uuidSchema = z
  .string()
  .uuid()

/** Clinic ID — UUID format when provided */
export const optionalUuidSchema = z
  .string()
  .uuid()
  .optional()
  .nullable()

/**
 * Schema for validating widget session token inputs
 * before calling validatePublicSessionToken().
 */
export const widgetTokenInputSchema = z.object({
  conversationId: uuidSchema,
  publicSessionToken: publicSessionTokenSchema,
  expectedClinicId: uuidSchema,
})

/**
 * Schema for the /api/chat request body — only the public-session-related fields.
 * Other fields (message, clinicSlug, visitorId) are validated inline in the route.
 */
export const chatPublicFieldsSchema = z.object({
  conversationId: uuidSchema.optional().nullable(),
  clinicId: uuidSchema.optional().nullable(),
  publicSessionToken: publicSessionTokenSchema.optional().nullable(),
})

/**
 * Schema for the /api/analytics/events request body.
 * Supports both legacy widget events and new widget analytics events.
 */
export const analyticsEventSchema = z.object({
  eventType: z.enum([
    // Legacy events
    'whatsapp_click',
    'call_click',
    'location_click',
    'directions_click',
    'appointment_request',
    // New widget lifecycle events
    'widget_loaded',
    'widget_opened',
    'widget_closed',
    'quick_prompt_clicked',
    'message_sent',
    'answer_received',
    'whatsapp_clicked',
    'maps_clicked',
  ]),
  source: z.enum(['playground', 'widget']),
  conversationId: uuidSchema.optional().nullable(),
  clinicId: uuidSchema.optional().nullable(),
  clinicSlug: clinicSlugSchema.optional().nullable(),
  publicSessionToken: publicSessionTokenSchema.optional().nullable(),
  widgetAccessToken: widgetAccessTokenSchema.optional().nullable(),
  visitorId: visitorIdSchema.optional().nullable(),
  service: z.string().max(200).optional().nullable(),
  metadata: metadataSchema,
})

/**
 * Schema for the /api/appointment-requests public fields.
 * Required appointment fields are validated inline in the route.
 */
export const appointmentRequestPublicFieldsSchema = z.object({
  clinicId: uuidSchema.optional().nullable(),
  clinicSlug: clinicSlugSchema.optional().nullable(),
  conversationId: uuidSchema.optional().nullable(),
  publicSessionToken: publicSessionTokenSchema.optional().nullable(),
  widgetAccessToken: widgetAccessTokenSchema.optional().nullable(),
  visitorId: visitorIdSchema.optional().nullable(),
  leadId: uuidSchema.optional().nullable(),
})

/** Type exports for use in route handlers */
export type WidgetTokenInput = z.infer<typeof widgetTokenInputSchema>
export type ChatPublicFields = z.infer<typeof chatPublicFieldsSchema>
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>
export type AppointmentRequestPublicFields = z.infer<typeof appointmentRequestPublicFieldsSchema>
