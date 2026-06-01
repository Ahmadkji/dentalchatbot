export type CustomizationCollectMode = 'mandatory' | 'optional' | 'none'

export interface CustomizationSettings {
  fallback_message: string
  chat_mode: 'human' | 'ai'
  collect_user_details: CustomizationCollectMode
  disable_smart_followup: boolean
  smart_followup_count: number
}

export interface CustomizationSettingRowLike {
  key: string
  value: string
}

export const CUSTOMIZATION_DEFAULTS: CustomizationSettings = {
  fallback_message:
    "I'm sorry, I don't have the information you're looking for. Let me connect you with someone who can help.",
  chat_mode: 'ai',
  collect_user_details: 'optional',
  disable_smart_followup: false,
  smart_followup_count: 3,
}

export function readBool(value: string | undefined, fallback: boolean) {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function readCollectMode(value: string | undefined): CustomizationCollectMode {
  if (value === 'mandatory' || value === 'optional' || value === 'none') return value
  return CUSTOMIZATION_DEFAULTS.collect_user_details
}

export function mapCustomizationSettings(input: {
  fallbackMessage: string
  rows: CustomizationSettingRowLike[]
}): CustomizationSettings {
  const kv = new Map<string, string>(input.rows.map((row) => [row.key, row.value]))

  const collectUserDetails = kv.get('collect_user_details')
    ? readCollectMode(kv.get('collect_user_details'))
    : kv.get('lead_collection_enabled') === 'false'
      ? 'none'
      : CUSTOMIZATION_DEFAULTS.collect_user_details

  const smartFollowupRaw = Number(kv.get('smart_followup_count') ?? CUSTOMIZATION_DEFAULTS.smart_followup_count)
  const smartFollowupCount = Number.isFinite(smartFollowupRaw)
    ? Math.min(10, Math.max(1, Math.floor(smartFollowupRaw)))
    : CUSTOMIZATION_DEFAULTS.smart_followup_count

  return {
    fallback_message: input.fallbackMessage || CUSTOMIZATION_DEFAULTS.fallback_message,
    chat_mode: kv.get('chat_mode') === 'human' ? 'human' : 'ai',
    collect_user_details: collectUserDetails,
    disable_smart_followup: readBool(kv.get('disable_smart_followup'), CUSTOMIZATION_DEFAULTS.disable_smart_followup),
    smart_followup_count: smartFollowupCount,
  }
}

export function buildCustomizationSettingsRows(
  clinicId: string,
  settings: CustomizationSettings,
) {
  return [
    {
      clinic_id: clinicId,
      key: 'chat_mode',
      value: settings.chat_mode,
      category: 'communication',
      description: 'Controls whether new conversations start in human or AI mode.',
    },
    {
      clinic_id: clinicId,
      key: 'collect_user_details',
      value: settings.collect_user_details,
      category: 'lead-collection',
      description: 'Controls how aggressively the chatbot asks for user details.',
    },
    {
      clinic_id: clinicId,
      key: 'disable_smart_followup',
      value: String(settings.disable_smart_followup),
      category: 'automation',
      description: 'Disables or enables smart follow-up behavior.',
    },
    {
      clinic_id: clinicId,
      key: 'smart_followup_count',
      value: String(settings.smart_followup_count),
      category: 'automation',
      description: 'How many smart follow-up attempts are allowed.',
    },
  ]
}
