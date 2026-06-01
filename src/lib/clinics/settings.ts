import 'server-only'

import type { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { DEFAULT_LEAD_REQUIRED_FIELDS, serializeLeadRequiredFields } from '@/lib/leads/lead-gate-settings'

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
    key: 'lead_required_fields',
    value: serializeLeadRequiredFields(DEFAULT_LEAD_REQUIRED_FIELDS),
    category: 'lead-collection',
    description: 'Required contact fields visitors must complete before chat starts.',
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
  const { data, error } = await supabase
    .from('clinic_settings')
    .select('id,clinic_id,key,value,category,description,created_at,updated_at')
    .eq('clinic_id', clinicId)
    .order('category', { ascending: true })
    .order('key', { ascending: true })

  if (error) {
    throw error
  }

  const rows = (data ?? []) as ClinicSettingRow[]

  // Backfill any missing defaults for clinics created before the seed trigger existed.
  // Only runs when the DB returns fewer rows than expected, avoiding a wasteful
  // upsert on every GET request.
  if (rows.length < CLINIC_SETTING_DEFAULTS.length) {
    await ensureClinicSettings(supabase, clinicId)
    const refetched = await supabase
      .from('clinic_settings')
      .select('id,clinic_id,key,value,category,description,created_at,updated_at')
      .eq('clinic_id', clinicId)
      .order('category', { ascending: true })
      .order('key', { ascending: true })
    if (!refetched.error && refetched.data) {
      return refetched.data as ClinicSettingRow[]
    }
  }

  return rows
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
  const settings: Record<string, string> = {
    required_fields: serializeLeadRequiredFields(DEFAULT_LEAD_REQUIRED_FIELDS),
  }

  for (const row of rows) {
    if (!row.key.startsWith('lead_')) continue
    const shortKey = row.key.slice(5)
    if (!leadSettingKeysByShortName.has(shortKey)) continue
    settings[shortKey] = row.value
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
