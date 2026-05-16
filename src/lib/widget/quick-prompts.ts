/**
 * Shared quick-prompt helpers for widget prompt routes.
 *
 * Single source of truth for:
 * - supported intent values
 * - intent → message/actionType/actionValue mapping
 * - DB row → API response mapping
 *
 * Consumers: GET/POST/PATCH/reset-dental quick-prompt routes,
 *            widget-install-page editor (intent list).
 */

export const WIDGET_QUICK_PROMPT_INTENTS = [
  'book_appointment',
  'clinic_hours',
  'services_fees',
  'location',
  'talk_on_whatsapp',
  'emergency_help',
] as const

export type WidgetQuickPromptIntent = (typeof WIDGET_QUICK_PROMPT_INTENTS)[number]

export interface QuickPromptRow {
  id: string
  clinic_id: string
  label: string
  intent: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export function normalizeWidgetQuickPromptIntent(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function isSupportedWidgetQuickPromptIntent(
  value: string,
): value is WidgetQuickPromptIntent {
  return (WIDGET_QUICK_PROMPT_INTENTS as readonly string[]).includes(value)
}

export function messageForWidgetQuickPromptIntent(intent: string, label: string) {
  const messages: Record<string, string> = {
    book_appointment: "I'd like to book an appointment",
    clinic_hours: 'What are your clinic hours?',
    services_fees: 'Can you tell me about services and fees?',
    location: 'Where is the clinic located?',
    talk_on_whatsapp: 'I want to talk on WhatsApp',
    emergency_help: 'I need emergency dental help',
  }

  return messages[intent] ?? label
}

export function actionTypeForWidgetQuickPromptIntent(intent: string) {
  if (intent === 'book_appointment') return 'appointment' as const
  if (intent === 'talk_on_whatsapp') return 'link' as const
  return 'message' as const
}

export function actionValueForWidgetQuickPromptIntent(
  intent: string,
  options?: { whatsapp?: string | null },
) {
  if (intent === 'talk_on_whatsapp' && options?.whatsapp) {
    return `https://wa.me/${options.whatsapp.replace(/^\+/, '')}`
  }

  return null
}

export function mapWidgetQuickPromptRow(
  row: QuickPromptRow,
  options?: { whatsapp?: string | null },
) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    label: row.label,
    intent: row.intent,
    message: messageForWidgetQuickPromptIntent(row.intent, row.label),
    actionType: actionTypeForWidgetQuickPromptIntent(row.intent),
    actionValue: actionValueForWidgetQuickPromptIntent(row.intent, options),
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
