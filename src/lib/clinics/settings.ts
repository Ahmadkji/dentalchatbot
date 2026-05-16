import 'server-only'

import { z } from 'zod'
import type { createSupabaseRouteClient } from '@/lib/supabase/route-client'

type SupabaseRouteClient = NonNullable<Awaited<ReturnType<typeof createSupabaseRouteClient>>>

export const CLINIC_SETTING_DEFAULTS = [
  {
    key: 'ai_personality',
    value: 'friendly_professional',
    category: 'ai',
    description: 'Controls the default AI communication style.',
  },
  {
    key: 'after_hours_message',
    value: 'We are currently closed. Leave a message and the clinic will reply when it opens.',
    category: 'automation',
    description: 'Shown when the chatbot engages after clinic hours.',
  },
  {
    key: 'auto_reply',
    value: 'true',
    category: 'automation',
    description: 'Allows the assistant to answer patient questions automatically.',
  },
  {
    key: 'faq_enabled',
    value: 'true',
    category: 'automation',
    description: 'Lets the bot use FAQ-style responses when suitable.',
  },
  {
    key: 'appointment_buffer',
    value: '15',
    category: 'appointments',
    description: 'Minutes to leave between appointments.',
  },
  {
    key: 'max_advance_booking',
    value: '60',
    category: 'appointments',
    description: 'Maximum number of days patients can request in advance.',
  },
  {
    key: 'cancellation_policy',
    value: 'Please contact the clinic directly to cancel or reschedule an appointment.',
    category: 'appointments',
    description: 'Displayed when a patient asks about cancelling or rescheduling.',
  },
  {
    key: 'slot_duration',
    value: '30',
    category: 'appointments',
    description: 'Default appointment slot duration in minutes.',
  },
  {
    key: 'greeting_message',
    value: 'Hi! How can I help you today?',
    category: 'communication',
    description: 'Opening greeting for manual support moments.',
  },
  {
    key: 'closing_message',
    value: 'Please contact the clinic directly if you need anything else.',
    category: 'communication',
    description: 'Closing fallback message when the bot cannot help further.',
  },
  {
    key: 'emergency_response',
    value: 'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, contact the clinic or emergency services immediately.',
    category: 'communication',
    description: 'Safety response for urgent patient situations.',
  },
  {
    key: 'parking_info',
    value: '',
    category: 'communication',
    description: 'Optional parking or arrival notes for patients.',
  },
  {
    key: 'google_maps_url',
    value: '',
    category: 'communication',
    description: 'Optional Google Maps link for the clinic location.',
  },
  {
    key: 'bot_disabled_fields',
    value: '[]',
    category: 'communication',
    description: 'Clinic profile fields hidden from chatbot answers.',
  },
  {
    key: 'lead_collection_enabled',
    value: 'true',
    category: 'lead-collection',
    description: 'Enable visitor lead capture in the chatbot.',
  },
  {
    key: 'lead_collect_email',
    value: 'true',
    category: 'lead-collection',
    description: 'Collect patient email addresses during lead capture.',
  },
  {
    key: 'lead_collect_name',
    value: 'true',
    category: 'lead-collection',
    description: 'Collect patient names during lead capture.',
  },
  {
    key: 'lead_collect_phone',
    value: 'true',
    category: 'lead-collection',
    description: 'Collect patient phone numbers during lead capture.',
  },
  {
    key: 'lead_trigger_mode',
    value: 'interest',
    category: 'lead-collection',
    description: 'Defines when lead capture should begin.',
  },
  {
    key: 'lead_trigger_message_count',
    value: '1',
    category: 'lead-collection',
    description: 'How many messages before lead capture can start.',
  },
  {
    key: 'lead_trigger_keywords',
    value: 'pricing, demo, consultation, quote, appointment, contact, schedule, buy, purchase',
    category: 'lead-collection',
    description: 'Keywords that can trigger lead capture.',
  },
  {
    key: 'lead_notifications_enabled',
    value: 'true',
    category: 'lead-collection',
    description: 'Send notifications when a new lead is captured.',
  },
  {
    key: 'lead_notification_emails',
    value: '',
    category: 'lead-collection',
    description: 'Comma-separated email list for lead alerts.',
  },
  {
    key: 'lead_auto_escalation',
    value: 'false',
    category: 'lead-collection',
    description: 'Escalate leads automatically when the trigger conditions are met.',
  },
] as const

type ClinicSettingDefault = (typeof CLINIC_SETTING_DEFAULTS)[number]
export type ClinicSettingKey = ClinicSettingDefault['key']

const settingDefaultsByKey = new Map<ClinicSettingKey, ClinicSettingDefault>(
  CLINIC_SETTING_DEFAULTS.map((setting) => [setting.key, setting]),
)

const leadSettingDefaults = CLINIC_SETTING_DEFAULTS.filter((setting) =>
  setting.key.startsWith('lead_'),
)

const leadSettingKeysByShortName = new Map(
  leadSettingDefaults.map((setting) => [setting.key.slice(5), setting.key]),
)

export interface ClinicSettingRow {
  id: string
  clinic_id: string
  key: ClinicSettingKey
  value: string
  category: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface LeadCustomFieldRow {
  id: string
  clinic_id: string
  label: string
  field_type: 'text' | 'textarea' | 'select' | 'number' | 'email' | 'tel'
  required: boolean
  options: string[]
  placeholder: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LeadCustomFieldResponse {
  id: string
  clinicId: string
  label: string
  fieldType: LeadCustomFieldRow['field_type']
  required: boolean
  options: string[]
  placeholder: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export const leadCustomFieldSchema = z.object({
  label: z.string().trim().min(2, 'Label is required.').max(120, 'Label must be 120 characters or fewer.'),
  fieldType: z.enum(['text', 'textarea', 'select', 'number', 'email', 'tel']).default('text'),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(25).optional().default([]),
  placeholder: z
    .string()
    .trim()
    .max(160, 'Placeholder must be 160 characters or fewer.')
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined || value === null || value.length === 0) {
        return null
      }

      return value
    }),
  order: z.number().int().positive().optional(),
})

export const leadCustomFieldUpdateSchema = leadCustomFieldSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one custom-field property is required.',
)

export function isKnownClinicSettingKey(key: string): key is ClinicSettingKey {
  return settingDefaultsByKey.has(key as ClinicSettingKey)
}

export function serializeClinicSettingValue(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

function getClinicSettingDefault(key: ClinicSettingKey) {
  const setting = settingDefaultsByKey.get(key)
  if (!setting) {
    throw new Error(`Unknown clinic setting key: ${key}`)
  }

  return setting
}

function buildClinicSettingRows(clinicId: string, keys?: ClinicSettingKey[]) {
  const settings = keys
    ? keys.map((key) => getClinicSettingDefault(key))
    : CLINIC_SETTING_DEFAULTS

  return settings.map((setting) => ({
    clinic_id: clinicId,
    key: setting.key,
    value: setting.value,
    category: setting.category,
    description: setting.description,
  }))
}

export async function ensureClinicSettings(
  supabase: SupabaseRouteClient,
  clinicId: string,
  keys?: ClinicSettingKey[],
) {
  const rows = buildClinicSettingRows(clinicId, keys)
  if (rows.length === 0) return

  const { error } = await supabase.from('clinic_settings').upsert(rows, {
    onConflict: 'clinic_id,key',
    ignoreDuplicates: true,
  })

  if (error) {
    throw error
  }
}

export async function listClinicSettings(supabase: SupabaseRouteClient, clinicId: string) {
  await ensureClinicSettings(supabase, clinicId)

  const { data, error } = await supabase
    .from('clinic_settings')
    .select('id,clinic_id,key,value,category,description,created_at,updated_at')
    .eq('clinic_id', clinicId)
    .order('category', { ascending: true })
    .order('key', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ClinicSettingRow[]
}

export async function updateClinicSetting(
  supabase: SupabaseRouteClient,
  clinicId: string,
  key: ClinicSettingKey,
  value: unknown,
) {
  const setting = getClinicSettingDefault(key)

  const { data, error } = await supabase
    .from('clinic_settings')
    .upsert(
      {
        clinic_id: clinicId,
        key,
        value: serializeClinicSettingValue(value),
        category: setting.category,
        description: setting.description,
      },
      { onConflict: 'clinic_id,key' },
    )
    .select('id,clinic_id,key,value,category,description,created_at,updated_at')
    .single()

  if (error) {
    throw error
  }

  return data as ClinicSettingRow
}

export function mapLeadSettings(rows: ClinicSettingRow[]) {
  const settings: Record<string, string> = {}

  for (const row of rows) {
    if (!row.key.startsWith('lead_')) continue
    settings[row.key.slice(5)] = row.value
  }

  return settings
}

export function normalizeLeadSettingsInput(input: Record<string, unknown>) {
  const normalized: Partial<Record<ClinicSettingKey, string>> = {}

  for (const [shortKey, value] of Object.entries(input)) {
    const fullKey = leadSettingKeysByShortName.get(shortKey)
    if (!fullKey) continue
    normalized[fullKey] = serializeClinicSettingValue(value)
  }

  return normalized
}

export function mapLeadCustomField(row: LeadCustomFieldRow): LeadCustomFieldResponse {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    label: row.label,
    fieldType: row.field_type,
    required: row.required,
    options: row.options,
    placeholder: row.placeholder,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function normalizeLeadCustomFieldInput(
  input: z.infer<typeof leadCustomFieldSchema> | z.infer<typeof leadCustomFieldUpdateSchema>,
) {
  const normalized: Record<string, unknown> = {}

  if (input.label !== undefined) normalized.label = input.label
  if (input.fieldType !== undefined) normalized.field_type = input.fieldType
  if (input.required !== undefined) normalized.required = input.required
  if (input.options !== undefined) {
    normalized.options = [...new Set(input.options.map((option) => option.trim()).filter(Boolean))]
  }
  if (input.placeholder !== undefined) normalized.placeholder = input.placeholder
  if (input.order !== undefined) normalized.sort_order = input.order

  return normalized
}
