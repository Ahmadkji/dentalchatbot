import 'server-only'

import crypto from 'node:crypto'
import { serverEnv } from '@/lib/env/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { HUMAN_HANDOFF_MAX_ATTEMPTS } from '@/lib/human-handoff/status'
import type { HumanHandoffRequestRow, HumanHandoffStatus } from '@/lib/human-handoff/types'

const MAILERSEND_WEBHOOK_TEST_SECRET = 'test_Am3L1GuOIc4blLUuHqAPxxwkZaJyEk8G'

type MailerSendEventOutcome =
  | { kind: 'accepted'; providerEvent: string }
  | { kind: 'delivered'; providerEvent: string }
  | { kind: 'failed'; providerEvent: string; errorMessage: string }

interface MailerSendWebhookDataRecord {
  id?: unknown
  message_id?: unknown
  message?: {
    id?: unknown
  } | null
  email?: {
    id?: unknown
  } | null
}

export interface MailerSendWebhookPayload {
  type?: unknown
  data?: MailerSendWebhookDataRecord | null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function verifyMailerSendWebhookSignature(input: {
  rawBody: string
  signature: string | null
  secret: string
}) {
  const signature = input.signature?.trim() ?? ''
  if (!signature) return false

  const expected = crypto.createHmac('sha256', input.secret).update(input.rawBody).digest('base64')
  const received = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer)
}

export function isMailerSendWebhookTestPayload(payload: MailerSendWebhookPayload) {
  return asString(payload.type) === 'webhook.test'
}

export function getMailerSendWebhookSecret(payload: MailerSendWebhookPayload) {
  if (isMailerSendWebhookTestPayload(payload)) {
    return MAILERSEND_WEBHOOK_TEST_SECRET
  }

  return serverEnv.MAILERSEND_WEBHOOK_SIGNING_SECRET?.trim() || null
}

export function getMailerSendWebhookEventName(payload: MailerSendWebhookPayload) {
  return asString(payload.type)
}

export function getMailerSendWebhookMessageId(payload: MailerSendWebhookPayload) {
  const data = payload.data
  return (
    asString(data?.message?.id) ||
    asString(data?.message_id) ||
    asString(data?.email?.id) ||
    asString(data?.id) ||
    null
  )
}

function mapMailerSendWebhookEvent(eventName: string): MailerSendEventOutcome | null {
  if (eventName === 'activity.sent') {
    return { kind: 'accepted', providerEvent: eventName }
  }

  if (eventName === 'activity.delivered') {
    return { kind: 'delivered', providerEvent: eventName }
  }

  if (eventName === 'activity.soft_bounced') {
    return {
      kind: 'failed',
      providerEvent: eventName,
      errorMessage: 'MailerSend reported a soft bounce for the notification email.',
    }
  }

  if (eventName === 'activity.hard_bounced') {
    return {
      kind: 'failed',
      providerEvent: eventName,
      errorMessage: 'MailerSend reported a hard bounce for the notification email.',
    }
  }

  if (eventName === 'activity.spam_complaint') {
    return {
      kind: 'failed',
      providerEvent: eventName,
      errorMessage: 'MailerSend reported a spam complaint for the notification email.',
    }
  }

  return null
}

function buildWebhookUpdate(
  existing: HumanHandoffRequestRow,
  outcome: MailerSendEventOutcome,
  nowIso: string,
): { status: HumanHandoffStatus; update: Record<string, unknown> } | null {
  if (outcome.kind === 'accepted') {
    if (existing.status === 'delivered' || existing.status === 'failed') {
      return null
    }

    return {
      status: 'accepted',
      update: {
        status: 'accepted',
        provider_accepted_at: existing.provider_accepted_at ?? nowIso,
        provider_last_event: outcome.providerEvent,
        provider_last_event_at: nowIso,
      },
    }
  }

  if (outcome.kind === 'delivered') {
    if (existing.status === 'delivered') {
      return {
        status: 'delivered',
        update: {
          provider_last_event: outcome.providerEvent,
          provider_last_event_at: nowIso,
          provider_delivered_at: existing.provider_delivered_at ?? nowIso,
        },
      }
    }

    if (existing.status === 'failed') {
      return null
    }

    return {
      status: 'delivered',
      update: {
        status: 'delivered',
        sent_at: existing.sent_at ?? existing.provider_accepted_at ?? nowIso,
        provider_accepted_at: existing.provider_accepted_at ?? existing.sent_at ?? nowIso,
        provider_delivered_at: nowIso,
        provider_last_event: outcome.providerEvent,
        provider_last_event_at: nowIso,
        last_error: null,
        locked_at: null,
        locked_by: null,
      },
    }
  }

  if (existing.status === 'delivered') {
    return null
  }

  return {
    status: 'failed',
    update: {
      status: 'failed',
      attempt_count: HUMAN_HANDOFF_MAX_ATTEMPTS,
      provider_last_event: outcome.providerEvent,
      provider_last_event_at: nowIso,
      last_error: outcome.errorMessage,
      available_at: nowIso,
      locked_at: null,
      locked_by: null,
    },
  }
}

export async function applyMailerSendWebhookEvent(input: {
  eventName: string
  messageId: string
}) {
  const outcome = mapMailerSendWebhookEvent(input.eventName)
  if (!outcome) {
    console.info('[human-handoff:webhook] Ignoring unsupported MailerSend event', {
      eventName: input.eventName,
      messageId: input.messageId,
    })
    return { updated: false, reason: 'ignored_event' as const }
  }

  const adminClient = createSupabaseAdminClient()
  const { data: existing, error } = await adminClient
    .from('human_handoff_requests')
    .select(
      'id,clinic_id,conversation_id,lead_id,trigger_source,status,recipient_emails,visitor_name,visitor_email,visitor_phone,source_page,latest_user_message,assistant_message,summary,provider,provider_message_id,attempt_count,last_attempt_at,available_at,locked_at,locked_by,sent_at,provider_accepted_at,provider_delivered_at,provider_last_event,provider_last_event_at,last_error,created_at,updated_at',
    )
    .eq('provider_message_id', input.messageId)
    .maybeSingle()

  if (error) {
    console.error('[human-handoff:webhook] Failed to load handoff request by provider message id', {
      eventName: input.eventName,
      messageId: input.messageId,
      error: error.message,
    })
    throw error
  }

  if (!existing) {
    console.warn('[human-handoff:webhook] No handoff request found for MailerSend message id', {
      eventName: input.eventName,
      messageId: input.messageId,
    })
    return { updated: false, reason: 'missing_handoff' as const }
  }

  const existingRow = existing as unknown as HumanHandoffRequestRow
  const nowIso = new Date().toISOString()
  const next = buildWebhookUpdate(existingRow, outcome, nowIso)

  if (!next) {
    console.info('[human-handoff:webhook] MailerSend event did not advance the handoff state', {
      requestId: existingRow.id,
      conversationId: existingRow.conversation_id,
      currentStatus: existingRow.status,
      eventName: input.eventName,
    })
    return { updated: false, reason: 'no_state_change' as const }
  }

  const { error: updateError } = await adminClient
    .from('human_handoff_requests')
    .update(next.update)
    .eq('id', existingRow.id)

  if (updateError) {
    console.error('[human-handoff:webhook] Failed to update handoff state from MailerSend event', {
      requestId: existingRow.id,
      conversationId: existingRow.conversation_id,
      eventName: input.eventName,
      nextStatus: next.status,
      error: updateError.message,
    })
    throw updateError
  }

  console.info('[human-handoff:webhook] Applied MailerSend provider event', {
    requestId: existingRow.id,
    conversationId: existingRow.conversation_id,
    eventName: input.eventName,
    nextStatus: next.status,
  })

  return { updated: true, reason: 'updated' as const, status: next.status }
}
