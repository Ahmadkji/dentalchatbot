export type LeadGateField = 'name' | 'email' | 'phone'

export const LEAD_REQUIRED_FIELD_PRESETS: LeadGateField[][] = [
  ['name', 'email'],
  ['name', 'phone'],
  ['name', 'email', 'phone'],
]

export const DEFAULT_LEAD_REQUIRED_FIELDS: LeadGateField[] = ['name', 'email', 'phone']

export interface LeadGateSettingsRowLike {
  key: string
  value: string
}

export interface LeadGateSettings {
  collectionEnabled: boolean
  requiredFields: LeadGateField[]
  prompt: string
}

function isSameFieldPreset(left: LeadGateField[], right: LeadGateField[]) {
  return left.length === right.length && left.every((field, index) => field === right[index])
}

export function normalizeLeadRequiredFields(value: unknown): LeadGateField[] {
  if (!Array.isArray(value)) return [...DEFAULT_LEAD_REQUIRED_FIELDS]
  const parsed = value.filter(
    (field): field is LeadGateField => field === 'name' || field === 'email' || field === 'phone',
  )

  const matchedPreset = LEAD_REQUIRED_FIELD_PRESETS.find((preset) => isSameFieldPreset(preset, parsed))
  return matchedPreset ? [...matchedPreset] : [...DEFAULT_LEAD_REQUIRED_FIELDS]
}

export function parseLeadRequiredFieldsSettingValue(value: string | null | undefined): LeadGateField[] {
  if (!value) return [...DEFAULT_LEAD_REQUIRED_FIELDS]

  try {
    return normalizeLeadRequiredFields(JSON.parse(value))
  } catch {
    return [...DEFAULT_LEAD_REQUIRED_FIELDS]
  }
}

export function serializeLeadRequiredFields(fields: LeadGateField[]): string {
  return JSON.stringify(normalizeLeadRequiredFields(fields))
}

export function buildLeadGatePrompt(fields: LeadGateField[]) {
  const normalizedFields = normalizeLeadRequiredFields(fields)

  if (isSameFieldPreset(normalizedFields, ['name', 'email'])) {
    return 'Please share your name and email address to start the conversation.'
  }

  if (isSameFieldPreset(normalizedFields, ['name', 'phone'])) {
    return 'Please share your name and phone number to start the conversation.'
  }

  return 'Please share your name, email address, and phone number to start the conversation.'
}

export function getLeadGateSettings(rows: LeadGateSettingsRowLike[]): LeadGateSettings {
  const settingsMap = new Map(rows.map((row) => [row.key, row.value]))
  const requiredFields = parseLeadRequiredFieldsSettingValue(settingsMap.get('lead_required_fields'))

  return {
    collectionEnabled: settingsMap.get('lead_collection_enabled') !== 'false',
    requiredFields,
    prompt: buildLeadGatePrompt(requiredFields),
  }
}
