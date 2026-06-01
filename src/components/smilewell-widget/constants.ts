import type { ChatMessage, WidgetPublicConfig } from './types'
import { getDisplayTime } from './utils/time'

export const DEFAULT_WELCOME_MESSAGE =
  "Hi there! I'm the dental assistant. I can help with appointments, services, clinic hours, and location. **How can I help you today?**"

export const DEMO_WELCOME_MESSAGE =
  "Hi! I'm the **DentalGPT Studio** assistant. I can tell you about our AI front desk features, pricing, setup, and more.\n\n*This is a simulated demo — your clinic's bot will use AI to answer any patient question.*\n\n**How can I help you today?**"

export function createInitialMessages(isDemoMode: boolean): ChatMessage[] {
  if (isDemoMode) {
    return [
      {
        id: 'welcome',
        role: 'bot',
        content: DEMO_WELCOME_MESSAGE,
        timestamp: getDisplayTime(),
        showQuickActions: true,
      },
    ]
  }

  return [
    {
      id: 'welcome',
      role: 'bot',
      content: DEFAULT_WELCOME_MESSAGE,
      timestamp: getDisplayTime(),
      showQuickActions: true,
    },
  ]
}

export function createInitialWidgetConfig(isDemoMode: boolean): WidgetPublicConfig {
  if (isDemoMode) {
    return {
      widgetTitle: 'DentalGPT Studio',
      welcomeMessage: "Hi! I'm the DentalGPT Studio assistant. Ask me about features, pricing, setup, and more!",
      primaryColor: '#059669',
      leadGateRequired: false,
      quickPrompts: [
        { label: 'What can you do?', intent: 'services' },
        { label: 'How much?', intent: 'services_fees' },
        { label: 'How to start?', intent: 'general' },
        { label: 'See an example', intent: 'general' },
      ],
      showWhatsappButton: false,
      showCallButton: false,
      showLocationButton: false,
      whatsappLink: null,
      phoneLink: null,
      mapsLink: null,
    }
  }

  return {
    widgetTitle: 'Dental Assistant',
    welcomeMessage:
      "Hi there! I'm the dental assistant. I can help with appointments, services, clinic hours, and location. How can I help you today?",
    primaryColor: '#059669',
    leadGateRequired: false,
    quickPrompts: [
      { label: 'Book Appointment', intent: 'appointment_request' },
      { label: 'Services', intent: 'services' },
      { label: 'Ask a Question', intent: 'general' },
    ],
    showWhatsappButton: false,
    showCallButton: false,
    showLocationButton: false,
    whatsappLink: null,
    phoneLink: null,
    mapsLink: null,
  }
}
