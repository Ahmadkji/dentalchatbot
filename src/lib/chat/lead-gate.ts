import {
  type LeadGateField,
  DEFAULT_LEAD_REQUIRED_FIELDS,
} from '@/lib/leads/lead-gate-settings'

export { type LeadGateField, DEFAULT_LEAD_REQUIRED_FIELDS }

export const LEAD_GATE_PROMPT =
  'Please share your name, email, and phone number to start the conversation.'

export const LEAD_GATE_QUESTION = 'Pre-chat lead intake'

export function buildLeadGatePayload(prefill?: {
  fields?: LeadGateField[]
  prompt?: string
  name?: string | null
  phone?: string | null
  email?: string | null
}) {
  return {
    fields: [...(prefill?.fields ?? DEFAULT_LEAD_REQUIRED_FIELDS)] as LeadGateField[],
    inquiry: '',
    prompt: prefill?.prompt ?? LEAD_GATE_PROMPT,
    canDismiss: false,
    prefill: {
      name: prefill?.name ?? null,
      phone: prefill?.phone ?? null,
      email: prefill?.email ?? null,
    },
  }
}

export function shouldRequireLeadGate(input: {
  canCaptureLeads: boolean
  leadCollectionEnabled: boolean
  hasLeadCaptured: boolean
  isPublicWidget: boolean
}) {
  return input.isPublicWidget && input.canCaptureLeads && input.leadCollectionEnabled && !input.hasLeadCaptured
}
