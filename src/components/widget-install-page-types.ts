// --- Types ---

export interface WidgetSettings {
  enabled: boolean
  botName: string
  welcomeMessage: string
  primaryColor: string
  widgetPosition: 'bottom-right' | 'bottom-left'
  embedCode: string
  clinicId: string
  allowedDomains: string[]
  slug: string
}

export type QuickPromptIntent =
  | 'book_appointment'
  | 'clinic_hours'
  | 'services_fees'
  | 'location'
  | 'talk_on_whatsapp'
  | 'emergency_help'

export interface QuickPrompt {
  id: string
  label: string
  intent: string
  sortOrder: number
  isActive: boolean
}

export interface WidgetTemplate {
  id: string
  label: string
  primaryColor: string
  textOnPrimary: string
}

// --- Config ---

export const longFields = new Set(['welcomeMessage'])

export const emptyPrompt: {
  label: string
  intent: QuickPromptIntent
  sortOrder: number
  isActive: boolean
} = {
  label: '',
  intent: 'book_appointment',
  sortOrder: 99,
  isActive: true,
}

export const quickPromptIntentOptions: Array<{
  value: QuickPromptIntent
  label: string
  description: string
}> = [
  {
    value: 'book_appointment',
    label: 'Book Appointment',
    description: 'Opens the appointment form inside the widget.',
  },
  {
    value: 'clinic_hours',
    label: 'Clinic Hours',
    description: 'Sends a message asking about clinic hours.',
  },
  {
    value: 'services_fees',
    label: 'Services & Fees',
    description: 'Sends a message asking about services and pricing.',
  },
  {
    value: 'location',
    label: 'Location',
    description: 'Opens the clinic location link.',
  },
  {
    value: 'talk_on_whatsapp',
    label: 'Talk on WhatsApp',
    description: 'Opens the clinic WhatsApp link.',
  },
  {
    value: 'emergency_help',
    label: 'Emergency Help',
    description: 'Sends an emergency help message.',
  },
]

export function getQuickPromptIntentMeta(intent?: string | null) {
  return (
    quickPromptIntentOptions.find((option) => option.value === intent) || {
      value: 'clinic_hours',
      label: intent || 'Custom Intent',
      description: 'Legacy or custom prompt intent.',
    }
  )
}
