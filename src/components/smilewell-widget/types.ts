import type { LeadGateField } from '@/lib/chat/lead-gate'

export interface ChatMessage {
  id: string
  role: 'bot' | 'user'
  content: string
  timestamp: string
  showForm?: boolean
  showQuickActions?: boolean
  followupSuggestions?: string[]
  leadCapture?: {
    fields: Array<'name' | 'phone' | 'email'>
    inquiry: string
    prompt: string
    canDismiss: boolean
    prefill: {
      name: string | null
      phone: string | null
      email: string | null
    }
  }
}

export interface WidgetQuickPrompt {
  label: string
  intent?: string | null
}

export interface WidgetLeadGatePayload {
  fields: LeadGateField[]
  inquiry: string
  prompt: string
  canDismiss: boolean
  prefill: {
    name: string | null
    phone: string | null
    email: string | null
  }
}

export interface WidgetPublicConfig {
  widgetTitle?: string
  welcomeMessage?: string
  primaryColor?: string
  leadGateRequired?: boolean
  leadGate?: WidgetLeadGatePayload
  showWhatsappButton?: boolean
  showCallButton?: boolean
  showLocationButton?: boolean
  whatsappLink?: string | null
  phoneLink?: string | null
  mapsLink?: string | null
  quickPrompts?: WidgetQuickPrompt[]
}

export interface WidgetProps {
  embedded?: boolean
  clinicId?: string | null
  clinicSlug?: string | null
  preview?: boolean
  sessionHandoff?: boolean
}
