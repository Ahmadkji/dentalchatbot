import 'server-only'

import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { CLINIC_SETTING_DEFAULTS } from '@/lib/clinics/settings'

export type SupportLevel = 'strong' | 'medium' | 'weak'

export type LeadAutomationSettings = {
  collectionEnabled: boolean
  collectEmail: boolean
  collectName: boolean
  collectPhone: boolean
  triggerMode: 'interest' | 'always' | 'manual'
  triggerMessageCount: number
  triggerKeywords: string[]
  autoEscalation: boolean
}

export type ConversationAutomationState = {
  leadId: string | null
  appointmentRequestId: string | null
  fields: {
    name?: string
    phone?: string
    email?: string
    preferredDate?: string
    preferredTime?: string
    reason?: string
    preferredDoctor?: string
    serviceName?: string
  }
}

type ClinicSettingRowLike = {
  key: string
  value: string
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/
const TIME_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)\b/i
const PHONE_RE = /\+?[0-9][0-9()\s.-]{7,20}[0-9]/

export function defaultAutomationState(): ConversationAutomationState {
  return {
    leadId: null,
    appointmentRequestId: null,
    fields: {},
  }
}

export function normalizeAutomationState(input: unknown): ConversationAutomationState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return defaultAutomationState()
  }

  const value = input as Record<string, unknown>
  const fields = value.fields && typeof value.fields === 'object' && !Array.isArray(value.fields)
    ? (value.fields as Record<string, string>)
    : {}

  return {
    leadId: typeof value.leadId === 'string' ? value.leadId : null,
    appointmentRequestId: typeof value.appointmentRequestId === 'string' ? value.appointmentRequestId : null,
    fields: {
      name: typeof fields.name === 'string' ? fields.name : undefined,
      phone: typeof fields.phone === 'string' ? fields.phone : undefined,
      email: typeof fields.email === 'string' ? fields.email : undefined,
      preferredDate: typeof fields.preferredDate === 'string' ? fields.preferredDate : undefined,
      preferredTime: typeof fields.preferredTime === 'string' ? fields.preferredTime : undefined,
      reason: typeof fields.reason === 'string' ? fields.reason : undefined,
      preferredDoctor: typeof fields.preferredDoctor === 'string' ? fields.preferredDoctor : undefined,
      serviceName: typeof fields.serviceName === 'string' ? fields.serviceName : undefined,
    },
  }
}

export function mapLeadAutomationSettings(rows: ClinicSettingRowLike[]): LeadAutomationSettings {
  const defaults = new Map<string, string>(
    CLINIC_SETTING_DEFAULTS
      .filter((row) => row.key.startsWith('lead_'))
      .map((row) => [row.key, row.value]),
  )

  for (const row of rows) {
    if (row.key.startsWith('lead_')) {
      defaults.set(row.key, row.value)
    }
  }

  return {
    collectionEnabled: defaults.get('lead_collection_enabled') !== 'false',
    collectEmail: defaults.get('lead_collect_email') !== 'false',
    collectName: defaults.get('lead_collect_name') !== 'false',
    collectPhone: defaults.get('lead_collect_phone') !== 'false',
    triggerMode: (defaults.get('lead_trigger_mode') as LeadAutomationSettings['triggerMode']) || 'interest',
    triggerMessageCount: Math.max(1, Number(defaults.get('lead_trigger_message_count') || '1')),
    triggerKeywords: String(defaults.get('lead_trigger_keywords') || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    autoEscalation: defaults.get('lead_auto_escalation') === 'true',
  }
}

export function extractAutomationFields(lines: string[]): ConversationAutomationState['fields'] {
  const text = lines.join('\n')
  const email = text.match(EMAIL_RE)?.[0]
  const rawPhone = text.match(PHONE_RE)?.[0]
  const parsedPhone = rawPhone ? parsePhoneNumberFromString(rawPhone, 'US') : null
  const preferredDate = text.match(ISO_DATE_RE)?.[0]
  const preferredTime = text.match(TIME_RE)?.[0]

  return {
    email,
    phone: parsedPhone?.isValid() ? parsedPhone.number : undefined,
    preferredDate,
    preferredTime,
  }
}

export function mergeAutomationState(
  previousState: unknown,
  extractedFields: ConversationAutomationState['fields'],
): ConversationAutomationState {
  const normalized = normalizeAutomationState(previousState)
  return {
    ...normalized,
    fields: {
      ...normalized.fields,
      ...Object.fromEntries(
        Object.entries(extractedFields).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
      ),
    },
  }
}

export function detectHumanHelpIntent(message: string) {
  return /(appointment|book|schedule|call me|contact me|quote|price|pricing|consultation)/i.test(message)
}

export function shouldCreateLead(input: {
  settings: LeadAutomationSettings
  state: ConversationAutomationState
  messageCount: number
  latestUserMessage: string
  supportLevel: SupportLevel
}) {
  if (!input.settings.collectionEnabled) return false
  if (input.state.leadId) return false
  if (!input.state.fields.phone) return false

  if (input.settings.triggerMode === 'manual') return false
  if (input.settings.triggerMode === 'always') return true

  const lower = input.latestUserMessage.toLowerCase()
  const keywordHit = input.settings.triggerKeywords.some((keyword) => lower.includes(keyword))

  return (
    input.messageCount >= input.settings.triggerMessageCount ||
    keywordHit ||
    detectHumanHelpIntent(input.latestUserMessage) ||
    input.supportLevel === 'weak'
  )
}

export function shouldCreateAppointmentRequest(input: {
  state: ConversationAutomationState
  transcriptLines: string[]
}) {
  const hasBookingIntent = input.transcriptLines.some((line) => detectHumanHelpIntent(line))

  return Boolean(
    hasBookingIntent &&
    !input.state.appointmentRequestId &&
    input.state.fields.phone &&
    input.state.fields.preferredDate &&
    input.state.fields.preferredTime
  )
}

export function canAnswerFromClinicProfile(message: string) {
  return /(hours|open|closed|address|location|where|phone|call|whatsapp|map|directions|book|appointment|schedule)/i.test(
    message,
  )
}

export function buildSafeAssistantReply(input: {
  aiResponse: string
  supportLevel: SupportLevel
  fallbackMessage: string
  latestUserMessage: string
}) {
  if (input.supportLevel === 'weak' && !canAnswerFromClinicProfile(input.latestUserMessage)) {
    return input.fallbackMessage
  }

  return input.aiResponse
}
