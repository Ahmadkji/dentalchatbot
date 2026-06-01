export type NormalizedQuickPromptIntent =
  | 'appointment'
  | 'services'
  | 'location'
  | 'whatsapp'
  | 'hours'
  | 'emergency'
  | 'message'

export function normalizeQuickPromptIntent(intent?: string | null): NormalizedQuickPromptIntent {
  switch (intent) {
    case 'book_appointment':
    case 'appointment_request':
      return 'appointment'
    case 'services':
    case 'services_fees':
      return 'services'
    case 'location':
      return 'location'
    case 'talk_on_whatsapp':
      return 'whatsapp'
    case 'clinic_hours':
      return 'hours'
    case 'emergency_help':
      return 'emergency'
    default:
      return 'message'
  }
}
