import 'server-only'

import {
  normalizeAllowedDomains,
  normalizeClinicProfileUpdate,
  normalizeOptionalHttpsUrlIfPossible,
  normalizeOptionalPhoneNumberIfPossible,
  serviceCreateSchema,
  normalizeServiceInput,
} from '@/lib/clinics/validation'
import { DAY_NAMES, normalizeClinicHours, type ClinicHourInput } from '@/lib/clinics/hours'
import type { WebsiteAutofill } from '@/lib/ai/website-autofill'

export type AutofillDetectedFieldType =
  | 'name'
  | 'phone'
  | 'whatsapp'
  | 'address'
  | 'city'
  | 'opening_hours'
  | 'pricing_notes'
  | 'emergency_instructions'

export interface AutofillDetectedFieldInput {
  fieldType: AutofillDetectedFieldType
  value: string
  confidence: number
  sourceUrl: string
  sourceSnippet: string
}

const DEFAULT_PRIMARY_COLOR = '#059669'
const DEFAULT_WIDGET_POSITION = 'bottom-right' as const
const DEFAULT_TONE = 'friendly' as const

function cleanText(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return trimmed.length > 0 ? trimmed : null
}

function buildEvidenceLookup(autofill: WebsiteAutofill) {
  const lookup = new Map<string, { value: string; sourceUrl: string; sourceSnippet: string; confidence: number }>()

  for (const evidence of autofill.knowledge.sourceEvidence) {
    const key = evidence.field.toLowerCase()
    if (!lookup.has(key)) {
      lookup.set(key, {
        value: evidence.value,
        sourceUrl: evidence.sourceUrl,
        sourceSnippet: evidence.sourceSnippet,
        confidence: evidence.confidence,
      })
    }
  }

  return lookup
}

function getEvidence(
  lookup: Map<string, { value: string; sourceUrl: string; sourceSnippet: string; confidence: number }>,
  field: AutofillDetectedFieldType,
  fallbackUrl: string,
  fallbackValue: string | null,
  fallbackSnippet: string,
) {
  const direct = lookup.get(field)
  if (direct) return direct

  return {
    value: fallbackValue ?? '',
    sourceUrl: fallbackUrl,
    sourceSnippet: fallbackSnippet,
    confidence: fallbackValue ? 0.55 : 0.15,
  }
}

export interface ClinicProfileAutofillPolicyResult {
  updateData: ReturnType<typeof normalizeClinicProfileUpdate>
  warnings: string[]
  skippedFields: string[]
}

function addSkippedField(
  result: ClinicProfileAutofillPolicyResult,
  field: string,
  reason: string,
) {
  result.skippedFields.push(field)
  result.warnings.push(`Skipped ${field}: ${reason}`)
}

export function buildClinicProfileUpdatePolicyFromAutofill(
  autofill: WebsiteAutofill,
  options?: { defaultCountry?: string | null },
): ClinicProfileAutofillPolicyResult {
  const result: ClinicProfileAutofillPolicyResult = {
    updateData: {},
    warnings: [],
    skippedFields: [],
  }

  const name = cleanText(autofill.clinic.name) ?? cleanText(autofill.knowledge.title)
  if (name) {
    result.updateData.name = name
  }

  const phone = normalizeOptionalPhoneNumberIfPossible(autofill.clinic.phone, {
    defaultCountry: options?.defaultCountry ?? null,
  })
  if (phone) {
    result.updateData.phone = phone
  } else if (cleanText(autofill.clinic.phone)) {
    addSkippedField(result, 'phone', 'it was not a valid phone number')
  }

  const whatsapp = normalizeOptionalPhoneNumberIfPossible(autofill.clinic.whatsapp, {
    defaultCountry: options?.defaultCountry ?? null,
  })
  if (whatsapp) {
    result.updateData.whatsapp = whatsapp
  } else if (cleanText(autofill.clinic.whatsapp)) {
    addSkippedField(result, 'whatsapp', 'it was not a valid phone number')
  }

  const address = cleanText(autofill.clinic.address)
  if (address) {
    result.updateData.address = address
  }

  const city = cleanText(autofill.clinic.city)
  if (city) {
    result.updateData.city = city
  }

  const websiteUrl = normalizeOptionalHttpsUrlIfPossible(
    cleanText(autofill.clinic.websiteUrl) ?? autofill.knowledge.sourceEvidence[0]?.sourceUrl ?? null,
  )
  if (websiteUrl) {
    result.updateData.website_url = websiteUrl
  } else if (cleanText(autofill.clinic.websiteUrl) || autofill.knowledge.sourceEvidence[0]?.sourceUrl) {
    addSkippedField(result, 'website_url', 'it was not a secure https URL')
  }

  const mapLink = normalizeOptionalHttpsUrlIfPossible(autofill.clinic.mapLink)
  if (mapLink) {
    result.updateData.map_link = mapLink
  } else if (cleanText(autofill.clinic.mapLink)) {
    addSkippedField(result, 'map_link', 'it was not a secure https URL')
  }

  const pricingNotes = cleanText(autofill.clinic.pricingNotes)
  if (pricingNotes) {
    result.updateData.pricing_notes = pricingNotes
  }

  const appointmentRules = cleanText(autofill.clinic.appointmentRules)
  if (appointmentRules) {
    result.updateData.appointment_rules = appointmentRules
  }

  const emergencyInstructions = cleanText(autofill.clinic.emergencyInstructions)
  if (emergencyInstructions) {
    result.updateData.emergency_instructions = emergencyInstructions
  }

  const defaultCurrency = cleanText(autofill.clinic.defaultCurrency)?.toUpperCase()
  if (defaultCurrency && /^[A-Z]{3}$/.test(defaultCurrency)) {
    result.updateData.default_currency = defaultCurrency
  } else if (cleanText(autofill.clinic.defaultCurrency)) {
    addSkippedField(result, 'default_currency', 'it was not a valid ISO currency code')
  }

  return result
}

export function buildClinicProfileUpdateFromAutofill(
  autofill: WebsiteAutofill,
  options?: { defaultCountry?: string | null },
) {
  return buildClinicProfileUpdatePolicyFromAutofill(autofill, options).updateData
}

export function buildWidgetSettingsFromAutofill(autofill: WebsiteAutofill) {
  const clinicName = cleanText(autofill.clinic.name) ?? 'Ask our dental clinic'
  const websiteUrl = cleanText(autofill.clinic.websiteUrl) ?? autofill.knowledge.sourceEvidence[0]?.sourceUrl ?? null
  const allowedDomains = normalizeAllowedDomains(autofill.widget.allowedDomains.length ? autofill.widget.allowedDomains : websiteUrl ? [websiteUrl] : [])

  return {
    enabled: true,
    widget_title: cleanText(autofill.widget.widgetTitle) ?? clinicName,
    welcome_message:
      cleanText(autofill.widget.welcomeMessage) ??
      `Hi! I can help with clinic hours, location, services, fees, and appointment requests at ${clinicName}.`,
    primary_color: cleanText(autofill.widget.primaryColor) ?? DEFAULT_PRIMARY_COLOR,
    position: autofill.widget.position ?? DEFAULT_WIDGET_POSITION,
    show_whatsapp_button: autofill.widget.showWhatsappButton,
    show_call_button: autofill.widget.showCallButton,
    show_location_button: autofill.widget.showLocationButton,
    allowed_domains: allowedDomains,
  }
}

export function buildBotSettingsFromAutofill(autofill: WebsiteAutofill) {
  const clinicName = cleanText(autofill.clinic.name) ?? 'Dental Assistant'
  return {
    bot_name: cleanText(autofill.bot.botName) ?? clinicName,
    tone: autofill.bot.tone ?? DEFAULT_TONE,
    fallback_message:
      cleanText(autofill.bot.fallbackMessage) ??
      "I'm not sure about that. Please contact the clinic directly for accurate information.",
    medical_disclaimer:
      cleanText(autofill.bot.medicalDisclaimer) ??
      'I can share clinic information, but I can not diagnose dental or medical conditions.',
    emergency_message:
      cleanText(autofill.bot.emergencyMessage) ??
      'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, please contact the clinic or emergency services immediately.',
    appointment_mode: autofill.bot.appointmentMode,
    whatsapp_handoff_enabled: autofill.bot.whatsappHandoffEnabled,
    lead_capture_enabled: autofill.bot.leadCaptureEnabled,
  }
}

export function buildClinicSettingsFromAutofill(autofill: WebsiteAutofill) {
  const normalizedHours = buildClinicHoursFromAutofill(autofill)
  const hoursText = normalizedHours
    ? normalizedHours
        .map((row) => {
          const dayName = DAY_NAMES[row.day_of_week] ?? `Day ${row.day_of_week}`
          if (!row.is_open) return `${dayName}: closed`
          return `${dayName}: ${row.open_time ?? '00:00'}-${row.close_time ?? '00:00'}`
        })
        .join('\n')
    : null

  return [
    { key: 'after_hours_message', value: cleanText(autofill.settings.afterHoursMessage) ?? (hoursText ? `We are currently closed. Our hours are:\n${hoursText}` : 'We are currently closed. Leave a message and the clinic will reply when it opens.') },
    { key: 'greeting_message', value: cleanText(autofill.settings.greetingMessage) ?? 'Hi! How can I help you today?' },
    { key: 'closing_message', value: cleanText(autofill.settings.closingMessage) ?? 'Please contact the clinic directly if you need anything else.' },
    { key: 'emergency_response', value: cleanText(autofill.settings.emergencyResponse) ?? (autofill.clinic.emergencyInstructions ? cleanText(autofill.clinic.emergencyInstructions)! : 'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, contact the clinic or emergency services immediately.') },
    { key: 'lead_collection_enabled', value: String(autofill.settings.leadCollectionEnabled) },
    { key: 'lead_notifications_enabled', value: String(autofill.settings.leadNotificationsEnabled) },
    { key: 'lead_notification_emails', value: autofill.settings.leadNotificationEmails.join(', ') },
    { key: 'chat_mode', value: 'ai' },
    { key: 'collect_user_details', value: autofill.settings.collectUserDetails },
    { key: 'disable_smart_followup', value: String(autofill.settings.disableSmartFollowup) },
    { key: 'smart_followup_count', value: String(autofill.settings.smartFollowupCount) },
  ]
}

export function buildClinicHoursFromAutofill(autofill: WebsiteAutofill): ClinicHourInput[] | null {
  if (!autofill.hours) return null
  return normalizeClinicHours(autofill.hours.days)
}

export function buildServicePayloadsFromAutofill(autofill: WebsiteAutofill) {
  const uniqueServices = new Map<string, ReturnType<typeof normalizeServiceInput>>()

  for (const service of autofill.services) {
    const parsed = serviceCreateSchema.safeParse({
      name: service.name,
      description: service.description ?? undefined,
      category: service.category ?? undefined,
      price_type: service.priceType,
      price_amount: service.priceAmount ?? undefined,
      price_min_amount: service.priceMinAmount ?? undefined,
      price_max_amount: service.priceMaxAmount ?? undefined,
      price_currency: service.priceCurrency ?? undefined,
      pricing_note: service.pricingNote ?? undefined,
      duration_minutes: service.durationMinutes,
      is_active: true,
      sort_order: service.sortOrder,
      is_price_visible_to_chatbot: service.isPriceVisibleToChatbot,
      requires_consultation: service.requiresConsultation,
    })

    if (!parsed.success) {
      continue
    }

    const normalized = normalizeServiceInput(parsed.data)
    const key = normalized.name.toLowerCase()
    if (!uniqueServices.has(key)) {
      uniqueServices.set(key, normalized)
    }
  }

  return [...uniqueServices.values()].slice(0, 8)
}

export function buildAutofillDetectedFields(autofill: WebsiteAutofill) {
  const lookup = buildEvidenceLookup(autofill)
  const websiteUrl = cleanText(autofill.clinic.websiteUrl) ?? autofill.knowledge.sourceEvidence[0]?.sourceUrl ?? 'https://example.com'
  const fallbackSnippet = cleanText(autofill.knowledge.summary) ?? autofill.knowledge.title

  const fieldDefs: Array<{
    fieldType: AutofillDetectedFieldType
    fallback: string | null
  }> = [
    { fieldType: 'name', fallback: autofill.clinic.name ?? autofill.knowledge.title },
    { fieldType: 'phone', fallback: autofill.clinic.phone },
    { fieldType: 'whatsapp', fallback: autofill.clinic.whatsapp },
    { fieldType: 'address', fallback: autofill.clinic.address },
    { fieldType: 'city', fallback: autofill.clinic.city },
    {
      fieldType: 'opening_hours',
      fallback: autofill.hours ? 'Opening hours found in website content.' : null,
    },
    { fieldType: 'pricing_notes', fallback: autofill.clinic.pricingNotes },
    { fieldType: 'emergency_instructions', fallback: autofill.clinic.emergencyInstructions },
  ]

  return fieldDefs
    .map((field) => {
      const evidence = getEvidence(
        lookup,
        field.fieldType,
        websiteUrl,
        field.fallback,
        fallbackSnippet,
      )

      if (!evidence.value.trim() && field.fieldType !== 'opening_hours') {
        return null
      }

      return {
        fieldType: field.fieldType,
        detectedValue: evidence.value.trim() || (field.fieldType === 'opening_hours' ? 'Opening hours found in website content.' : ''),
        sourceUrl: evidence.sourceUrl,
        sourceTextSnippet: evidence.sourceSnippet,
        confidence: evidence.confidence,
      }
    })
    .filter((value): value is {
      fieldType: AutofillDetectedFieldType
      detectedValue: string
      sourceUrl: string
      sourceTextSnippet: string
      confidence: number
    } => Boolean(value))
}
