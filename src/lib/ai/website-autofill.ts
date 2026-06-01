import 'server-only'

import { z } from 'zod'
import { serverEnv } from '@/lib/env/server'

const sourceEvidenceSchema = z.object({
  field: z.string().min(1),
  value: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceSnippet: z.string().min(1),
  confidence: z.number().min(0).max(1),
})

const clinicHoursDaySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  close_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  break_start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  break_end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  notes: z.string().max(240).nullable(),
})

const servicePriceTypeSchema = z.enum(['fixed', 'starting_from', 'range', 'free', 'quote_required'])

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable(),
  category: z.string().trim().max(80).nullable(),
  priceType: servicePriceTypeSchema,
  priceAmount: z.number().finite().min(0).nullable(),
  priceMinAmount: z.number().finite().min(0).nullable(),
  priceMaxAmount: z.number().finite().min(0).nullable(),
  priceCurrency: z.string().trim().length(3).nullable(),
  pricingNote: z.string().trim().max(400).nullable(),
  durationMinutes: z.number().int().positive(),
  isPriceVisibleToChatbot: z.boolean(),
  requiresConsultation: z.boolean(),
  sortOrder: z.number().int().positive(),
})

export const websiteAutofillSchema = z.object({
  clinic: z.object({
    name: z.string().trim().nullable(),
    phone: z.string().trim().nullable(),
    whatsapp: z.string().trim().nullable(),
    address: z.string().trim().nullable(),
    city: z.string().trim().nullable(),
    websiteUrl: z.string().url().nullable(),
    mapLink: z.string().url().nullable(),
    defaultCurrency: z.string().trim().length(3).nullable(),
    pricingNotes: z.string().trim().nullable(),
    appointmentRules: z.string().trim().nullable(),
    emergencyInstructions: z.string().trim().nullable(),
  }),
  widget: z.object({
    enabled: z.boolean(),
    widgetTitle: z.string().trim().nullable(),
    welcomeMessage: z.string().trim().nullable(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    position: z.enum(['bottom-right', 'bottom-left']),
    showWhatsappButton: z.boolean(),
    showCallButton: z.boolean(),
    showLocationButton: z.boolean(),
    allowedDomains: z.array(z.string().url()),
  }),
  bot: z.object({
    botName: z.string().trim().nullable(),
    tone: z.enum(['friendly', 'professional', 'concise']),
    fallbackMessage: z.string().trim().nullable(),
    medicalDisclaimer: z.string().trim().nullable(),
    emergencyMessage: z.string().trim().nullable(),
    appointmentMode: z.enum(['whatsapp', 'request_form', 'disabled']),
    whatsappHandoffEnabled: z.boolean(),
    leadCaptureEnabled: z.boolean(),
  }),
  settings: z.object({
    afterHoursMessage: z.string().trim().nullable(),
    greetingMessage: z.string().trim().nullable(),
    closingMessage: z.string().trim().nullable(),
    emergencyResponse: z.string().trim().nullable(),
    leadCollectionEnabled: z.boolean(),
    leadCollectName: z.boolean(),
    leadCollectEmail: z.boolean(),
    leadCollectPhone: z.boolean(),
    leadTriggerMode: z.enum(['interest', 'always', 'manual']),
    leadTriggerMessageCount: z.number().int().min(1).max(10),
    leadTriggerKeywords: z.array(z.string().trim()).max(30),
    leadNotificationsEnabled: z.boolean(),
    leadNotificationEmails: z.array(z.string().email()),
    leadAutoEscalation: z.boolean(),
    collectUserDetails: z.enum(['mandatory', 'optional', 'none']),
    disableSmartFollowup: z.boolean(),
    smartFollowupCount: z.number().int().min(1).max(10),
  }),
  hours: z.object({
    sourceUrl: z.string().url(),
    days: z.array(clinicHoursDaySchema).length(7),
  }).nullable(),
  services: z.array(serviceSchema).max(8),
  knowledge: z.object({
    title: z.string().trim().min(1),
    optimizedContent: z.string().trim().min(200),
    summary: z.string().trim().min(1),
    sourceEvidence: z.array(sourceEvidenceSchema).min(1),
  }),
  flags: z.object({
    needsReview: z.boolean(),
    reasons: z.array(z.string().trim()),
  }),
})

export type WebsiteAutofill = z.infer<typeof websiteAutofillSchema>

function normalizeAssistantContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text
        }
        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

const websiteAutofillJsonSchema = {
  name: 'website_autofill',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      clinic: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          whatsapp: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          websiteUrl: { type: ['string', 'null'] },
          mapLink: { type: ['string', 'null'] },
          defaultCurrency: { type: ['string', 'null'] },
          pricingNotes: { type: ['string', 'null'] },
          appointmentRules: { type: ['string', 'null'] },
          emergencyInstructions: { type: ['string', 'null'] },
        },
        required: ['name', 'phone', 'whatsapp', 'address', 'city', 'websiteUrl', 'mapLink', 'defaultCurrency', 'pricingNotes', 'appointmentRules', 'emergencyInstructions'],
      },
      widget: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'boolean' },
          widgetTitle: { type: ['string', 'null'] },
          welcomeMessage: { type: ['string', 'null'] },
          primaryColor: { type: ['string', 'null'] },
          position: { type: 'string', enum: ['bottom-right', 'bottom-left'] },
          showWhatsappButton: { type: 'boolean' },
          showCallButton: { type: 'boolean' },
          showLocationButton: { type: 'boolean' },
          allowedDomains: { type: 'array', items: { type: 'string', format: 'uri' } },
        },
        required: ['enabled', 'widgetTitle', 'welcomeMessage', 'primaryColor', 'position', 'showWhatsappButton', 'showCallButton', 'showLocationButton', 'allowedDomains'],
      },
      bot: {
        type: 'object',
        additionalProperties: false,
        properties: {
          botName: { type: ['string', 'null'] },
          tone: { type: 'string', enum: ['friendly', 'professional', 'concise'] },
          fallbackMessage: { type: ['string', 'null'] },
          medicalDisclaimer: { type: ['string', 'null'] },
          emergencyMessage: { type: ['string', 'null'] },
          appointmentMode: { type: 'string', enum: ['whatsapp', 'request_form', 'disabled'] },
          whatsappHandoffEnabled: { type: 'boolean' },
          leadCaptureEnabled: { type: 'boolean' },
        },
        required: ['botName', 'tone', 'fallbackMessage', 'medicalDisclaimer', 'emergencyMessage', 'appointmentMode', 'whatsappHandoffEnabled', 'leadCaptureEnabled'],
      },
      settings: {
        type: 'object',
        additionalProperties: false,
        properties: {
          afterHoursMessage: { type: ['string', 'null'] },
          greetingMessage: { type: ['string', 'null'] },
          closingMessage: { type: ['string', 'null'] },
          emergencyResponse: { type: ['string', 'null'] },
          leadCollectionEnabled: { type: 'boolean' },
          leadCollectName: { type: 'boolean' },
          leadCollectEmail: { type: 'boolean' },
          leadCollectPhone: { type: 'boolean' },
          leadTriggerMode: { type: 'string', enum: ['interest', 'always', 'manual'] },
          leadTriggerMessageCount: { type: 'integer' },
          leadTriggerKeywords: { type: 'array', items: { type: 'string' } },
          leadNotificationsEnabled: { type: 'boolean' },
          leadNotificationEmails: { type: 'array', items: { type: 'string', format: 'email' } },
          leadAutoEscalation: { type: 'boolean' },
          collectUserDetails: { type: 'string', enum: ['mandatory', 'optional', 'none'] },
          disableSmartFollowup: { type: 'boolean' },
          smartFollowupCount: { type: 'integer' },
        },
        required: ['afterHoursMessage', 'greetingMessage', 'closingMessage', 'emergencyResponse', 'leadCollectionEnabled', 'leadCollectName', 'leadCollectEmail', 'leadCollectPhone', 'leadTriggerMode', 'leadTriggerMessageCount', 'leadTriggerKeywords', 'leadNotificationsEnabled', 'leadNotificationEmails', 'leadAutoEscalation', 'collectUserDetails', 'disableSmartFollowup', 'smartFollowupCount'],
      },
      hours: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              sourceUrl: { type: 'string', format: 'uri' },
              days: {
                type: 'array',
                minItems: 7,
                maxItems: 7,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
                    is_open: { type: 'boolean' },
                    open_time: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    close_time: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    break_start_time: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    break_end_time: { type: ['string', 'null'], pattern: '^\\d{2}:\\d{2}$' },
                    notes: { type: ['string', 'null'] },
                  },
                  required: ['day_of_week', 'is_open', 'open_time', 'close_time', 'break_start_time', 'break_end_time', 'notes'],
                },
              },
            },
            required: ['sourceUrl', 'days'],
          },
        ],
      },
      services: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            description: { type: ['string', 'null'] },
            category: { type: ['string', 'null'] },
            priceType: { type: 'string', enum: ['fixed', 'starting_from', 'range', 'free', 'quote_required'] },
            priceAmount: { type: ['number', 'null'] },
            priceMinAmount: { type: ['number', 'null'] },
            priceMaxAmount: { type: ['number', 'null'] },
            priceCurrency: { type: ['string', 'null'] },
            pricingNote: { type: ['string', 'null'] },
            durationMinutes: { type: 'integer', minimum: 1 },
            isPriceVisibleToChatbot: { type: 'boolean' },
            requiresConsultation: { type: 'boolean' },
            sortOrder: { type: 'integer', minimum: 1 },
          },
          required: ['name', 'description', 'category', 'priceType', 'priceAmount', 'priceMinAmount', 'priceMaxAmount', 'priceCurrency', 'pricingNote', 'durationMinutes', 'isPriceVisibleToChatbot', 'requiresConsultation', 'sortOrder'],
        },
      },
      knowledge: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          optimizedContent: { type: 'string' },
          summary: { type: 'string' },
          sourceEvidence: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                field: { type: 'string' },
                value: { type: 'string' },
                sourceUrl: { type: 'string', format: 'uri' },
                sourceSnippet: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
              required: ['field', 'value', 'sourceUrl', 'sourceSnippet', 'confidence'],
            },
          },
        },
        required: ['title', 'optimizedContent', 'summary', 'sourceEvidence'],
      },
      flags: {
        type: 'object',
        additionalProperties: false,
        properties: {
          needsReview: { type: 'boolean' },
          reasons: { type: 'array', items: { type: 'string' } },
        },
        required: ['needsReview', 'reasons'],
      },
    },
    required: ['clinic', 'widget', 'bot', 'settings', 'hours', 'services', 'knowledge', 'flags'],
  },
} as const

export async function extractWebsiteAutofill(input: {
  websiteUrl: string
  text: string
  title?: string
}): Promise<WebsiteAutofill> {
  const controller = new AbortController()
  const timeoutMs = serverEnv.AI_RESPONSE_TIMEOUT_MS ?? 20_000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    }

    if (serverEnv.OPENROUTER_SITE_URL) {
      headers['HTTP-Referer'] = serverEnv.OPENROUTER_SITE_URL
    }

    if (serverEnv.OPENROUTER_SITE_NAME) {
      headers['X-OpenRouter-Title'] = serverEnv.OPENROUTER_SITE_NAME
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        model: serverEnv.OPENROUTER_MODEL,
        temperature: 0,
        max_tokens: 2400,
        messages: [
          {
            role: 'system',
            content: [
              'You rewrite a dental clinic website into production-safe chatbot data.',
              'Never guess facts. Only use information that appears in the website text.',
              'If a field is uncertain, return null and set needsReview to true.',
              'Do not invent hours, prices, phone numbers, services, or emergency instructions.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Website URL: ${input.websiteUrl}`,
              input.title ? `Page title: ${input.title}` : null,
              '',
              input.text,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: websiteAutofillJsonSchema,
        },
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const retryAfter = response.headers.get('Retry-After')
      const errorDetail = data?.error?.message ?? 'Unknown error'
      throw new Error(
        `OpenRouter website autofill failed with ${response.status}${retryAfter ? ` retry-after=${retryAfter}` : ''}: ${errorDetail}`,
      )
    }

    const rawContent = normalizeAssistantContent(data?.choices?.[0]?.message?.content)
    if (!rawContent) {
      throw new Error('OpenRouter returned no autofill content.')
    }

    const parsed = websiteAutofillSchema.safeParse(JSON.parse(rawContent))
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Invalid website autofill response.')
    }

    return parsed.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenRouter website autofill request timed out.')
    }

    if (error instanceof SyntaxError) {
      throw new Error('OpenRouter returned invalid JSON for website autofill.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
