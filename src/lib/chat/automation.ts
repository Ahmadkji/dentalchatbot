import 'server-only'

import { parsePhoneNumberFromString } from 'libphonenumber-js'

export type SupportLevel = 'strong' | 'medium' | 'weak'

export type ConversationAutomationState = {
  leadId: string | null
  appointmentRequestId: string | null
  followupCount: number
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

export type AutomationTranscriptMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/
const TIME_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)\b/i
const PHONE_RE = /\+?[0-9][0-9()\s.-]{7,20}[0-9]/

export function defaultAutomationState(): ConversationAutomationState {
  return {
    leadId: null,
    appointmentRequestId: null,
    followupCount: 0,
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
    followupCount:
      typeof value.followupCount === 'number' && Number.isFinite(value.followupCount)
        ? Math.max(0, Math.floor(value.followupCount))
        : 0,
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

function getUserTranscriptMessages(messages: AutomationTranscriptMessage[]) {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)
}

export function extractAutomationFields(messages: AutomationTranscriptMessage[]): ConversationAutomationState['fields'] {
  const text = getUserTranscriptMessages(messages).join('\n')
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

export function detectHumanHandoffIntent(message: string) {
  return /\b(human|agent|person|representative|staff|live chat|live person|real person|talk to (?:a|someone|human)|speak to (?:a|someone|human)|call me|contact me)\b/i.test(
    message,
  )
}

export function shouldCreateAppointmentRequest(input: {
  state: ConversationAutomationState
  messages: AutomationTranscriptMessage[]
}) {
  const hasBookingIntent = getUserTranscriptMessages(input.messages).some((message) => detectHumanHelpIntent(message))

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
