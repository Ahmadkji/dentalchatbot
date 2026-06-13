export type HumanHandoffStatus = 'queued' | 'sending' | 'sent' | 'accepted' | 'delivered' | 'failed'

export type HumanHandoffTriggerSource = 'chat_mode' | 'user_request' | 'widget_cta' | 'admin_action' | 'automation'

export interface HumanHandoffRequestRow {
  id: string
  clinic_id: string
  conversation_id: string
  lead_id: string | null
  trigger_source: HumanHandoffTriggerSource
  status: HumanHandoffStatus
  recipient_emails: string[]
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  source_page: string | null
  latest_user_message: string
  assistant_message: string
  summary: string
  provider: string
  provider_message_id: string | null
  attempt_count: number
  last_attempt_at: string | null
  available_at: string
  locked_at: string | null
  locked_by: string | null
  sent_at: string | null
  provider_accepted_at: string | null
  provider_delivered_at: string | null
  provider_last_event: string | null
  provider_last_event_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface HumanHandoffSnapshotInput {
  clinicId: string
  conversationId: string
  leadId?: string | null
  triggerSource: HumanHandoffTriggerSource
  visitorName?: string | null
  visitorEmail?: string | null
  visitorPhone?: string | null
  sourcePage?: string | null
  latestUserMessage: string
  assistantMessage: string
  summary: string
  recipientEmails: string[]
}
