import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizeEmail } from '@/lib/email-list'
import {
  type ClinicSettingRowLike,
  getHumanHandoffDeliveryConfiguration,
  resolveHumanHandoffRecipients,
} from '@/lib/human-handoff/config'
import { sendHumanHandoffEmail } from '@/lib/human-handoff/mailersend'
import {
  HUMAN_HANDOFF_LOCK_TIMEOUT_MS,
  HUMAN_HANDOFF_MAX_ATTEMPTS,
  getHumanHandoffNextAvailableAt,
  isHumanHandoffDeliveryCompleteStatus,
} from '@/lib/human-handoff/status'
import { HANDOFF_SELECT_COLUMNS, getHumanHandoffRunnerName } from '@/lib/human-handoff/store'
import type {
  HumanHandoffRequestRow,
  HumanHandoffSnapshotInput,
  HumanHandoffStatus,
} from '@/lib/human-handoff/types'

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>

interface QueueHumanHandoffInput extends Omit<HumanHandoffSnapshotInput, 'recipientEmails'> {
  clinicName: string
  clinicSlug: string
  dashboardUrl: string
  clinicSettings: ClinicSettingRowLike[]
}

interface DeliverHumanHandoffInput {
  requestId: string
  clinicName: string
  clinicSlug: string
  dashboardUrl: string
  runner?: string
}

interface QueueHumanHandoffResult {
  handoff: HumanHandoffRequestRow
  shouldDeliver: boolean
  reason: 'no_recipients' | 'provider_unconfigured' | null
}

function normalizeText(value: string | null | undefined, fallback = '') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed.length > 0 ? trimmed : fallback
}

function truncate(value: string | null | undefined, maxLength: number) {
  return normalizeText(value).slice(0, maxLength)
}

function buildRequestSnapshot(input: QueueHumanHandoffInput, recipientEmails: string[]): HumanHandoffSnapshotInput & {
  clinicName: string
  clinicSlug: string
  dashboardUrl: string
} {
  return {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    leadId: input.leadId ?? null,
    triggerSource: input.triggerSource,
    visitorName: input.visitorName ?? null,
    visitorEmail: input.visitorEmail ?? null,
    visitorPhone: input.visitorPhone ?? null,
    sourcePage: input.sourcePage ?? null,
    latestUserMessage: truncate(input.latestUserMessage, 2000),
    assistantMessage: truncate(input.assistantMessage, 2000),
    summary: truncate(input.summary, 2000),
    recipientEmails,
    clinicName: input.clinicName,
    clinicSlug: input.clinicSlug,
    dashboardUrl: input.dashboardUrl,
  }
}

function isRetryableHumanHandoffError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (
    message.includes('not configured') ||
    message.includes('without returning a message id') ||
    message.includes('recipient email')
  ) {
    return false
  }
  const match = message.match(/status\s+(\d{3})/i)
  const status = match ? Number(match[1]) : null
  if (status === null) return true
  return status >= 500 || status === 429 || status === 408
}

function getTerminalQueueReason(existingStatus: HumanHandoffStatus | null | undefined) {
  if (existingStatus === 'sending') return 'sending'
  if (isHumanHandoffDeliveryCompleteStatus(existingStatus)) return 'already_delivered'
  return null
}

export async function queueHumanHandoffRequest(
  adminClient: SupabaseAdminClient,
  input: QueueHumanHandoffInput,
): Promise<QueueHumanHandoffResult> {
  console.info('[human-handoff:queue] Queueing human handoff request', {
    clinicId: input.clinicId,
    clinicSlug: input.clinicSlug,
    conversationId: input.conversationId,
    triggerSource: input.triggerSource,
  })

  const readiness = getHumanHandoffDeliveryConfiguration(input.clinicSettings)
  const request = buildRequestSnapshot(input, readiness.recipientEmails)
  const existing = await adminClient
    .from('human_handoff_requests')
    .select(HANDOFF_SELECT_COLUMNS)
    .eq('clinic_id', input.clinicId)
    .eq('conversation_id', input.conversationId)
    .maybeSingle()

  if (existing.error) {
    console.error('[human-handoff:queue] Failed to load existing handoff request', {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      error: existing.error.message,
    })
    throw existing.error
  }

  const existingRow = (existing.data as HumanHandoffRequestRow | null) ?? null
  const terminalReason = getTerminalQueueReason(existingRow?.status)
  const nowIso = new Date().toISOString()
  const shouldDeliver = readiness.ready && terminalReason === null
  const deliveryAlreadyCompleted = isHumanHandoffDeliveryCompleteStatus(existingRow?.status)
  const nextStatus: HumanHandoffStatus =
    existingRow?.status === 'sending'
      ? 'sending'
      : deliveryAlreadyCompleted
        ? existingRow!.status
        : readiness.ready
          ? 'queued'
          : 'failed'

  const resetDeliveryState = !deliveryAlreadyCompleted

  const upsertPayload = {
    clinic_id: request.clinicId,
    conversation_id: request.conversationId,
    lead_id: request.leadId,
    trigger_source: request.triggerSource,
    status: nextStatus,
    recipient_emails: readiness.recipientEmails,
    visitor_name: normalizeText(request.visitorName) || null,
    visitor_email: normalizeEmail(request.visitorEmail) ?? null,
    visitor_phone: normalizeText(request.visitorPhone) || null,
    source_page: normalizeText(request.sourcePage) || null,
    latest_user_message: request.latestUserMessage,
    assistant_message: request.assistantMessage,
    summary: request.summary,
    provider: 'mailersend',
    provider_message_id: resetDeliveryState ? null : existingRow?.provider_message_id ?? null,
    attempt_count:
      deliveryAlreadyCompleted
        ? existingRow?.attempt_count ?? 0
        : !readiness.ready
        ? HUMAN_HANDOFF_MAX_ATTEMPTS
        : nextStatus === 'queued' && existingRow?.status === 'failed'
          ? 0
          : existingRow?.attempt_count ?? 0,
    last_attempt_at: shouldDeliver ? null : existingRow?.last_attempt_at ?? null,
    available_at: shouldDeliver ? nowIso : existingRow?.available_at ?? nowIso,
    locked_at: nextStatus === 'sending' ? existingRow?.locked_at ?? null : null,
    locked_by: nextStatus === 'sending' ? existingRow?.locked_by ?? null : null,
    sent_at: resetDeliveryState ? null : existingRow?.sent_at ?? null,
    provider_accepted_at: resetDeliveryState ? null : existingRow?.provider_accepted_at ?? null,
    provider_delivered_at: resetDeliveryState ? null : existingRow?.provider_delivered_at ?? null,
    provider_last_event: resetDeliveryState ? null : existingRow?.provider_last_event ?? null,
    provider_last_event_at: resetDeliveryState ? null : existingRow?.provider_last_event_at ?? null,
    last_error: deliveryAlreadyCompleted ? existingRow?.last_error ?? null : readiness.ready ? null : readiness.message,
  }

  const { data: savedRow, error: upsertError } = await adminClient
    .from('human_handoff_requests')
    .upsert(upsertPayload, { onConflict: 'clinic_id,conversation_id' })
    .select(HANDOFF_SELECT_COLUMNS)
    .single()

  if (upsertError || !savedRow) {
    console.error('[human-handoff:queue] Failed to upsert human handoff request', {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      error: upsertError instanceof Error ? upsertError.message : String(upsertError),
    })
    throw upsertError || new Error('Failed to queue human handoff request')
  }

  const row = savedRow as unknown as HumanHandoffRequestRow
  console.info('[human-handoff:queue] Human handoff request stored', {
    requestId: row.id,
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    status: row.status,
    recipientCount: row.recipient_emails.length,
    shouldDeliver,
  })

  return {
    handoff: row,
    shouldDeliver,
    reason: readiness.ready
      ? null
      : readiness.reason === 'provider_unconfigured'
        ? 'provider_unconfigured'
        : 'no_recipients',
  }
}

export async function deliverHumanHandoffRequest(
  adminClient: SupabaseAdminClient,
  input: DeliverHumanHandoffInput,
) {
  const runner = getHumanHandoffRunnerName(input.runner)

  console.info('[human-handoff:deliver] Attempting human handoff delivery', {
    requestId: input.requestId,
    clinicSlug: input.clinicSlug,
    runner,
  })

  const { data: existing, error: existingError } = await adminClient
    .from('human_handoff_requests')
    .select(HANDOFF_SELECT_COLUMNS)
    .eq('id', input.requestId)
    .maybeSingle()

  if (existingError) {
    console.error('[human-handoff:deliver] Failed to load handoff request', {
      requestId: input.requestId,
      clinicSlug: input.clinicSlug,
      runner,
      error: existingError.message,
    })
    throw existingError
  }

  if (!existing) {
    console.warn('[human-handoff:deliver] Hand-off request no longer exists', {
      requestId: input.requestId,
      clinicSlug: input.clinicSlug,
      runner,
    })
    return { delivered: false, reason: 'missing' as const }
  }

  const row = existing as unknown as HumanHandoffRequestRow

  if (isHumanHandoffDeliveryCompleteStatus(row.status) && row.provider_message_id) {
    console.info('[human-handoff:deliver] Hand-off already accepted by the provider', {
      requestId: row.id,
      clinicSlug: input.clinicSlug,
      providerMessageId: row.provider_message_id,
      status: row.status,
      runner,
    })
    return { delivered: true, reason: 'already_sent' as const, messageId: row.provider_message_id }
  }

  const staleLockBefore = new Date(Date.now() - HUMAN_HANDOFF_LOCK_TIMEOUT_MS).toISOString()
  const staleLockedAt = row.locked_at ?? ''
  const isStaleSending = row.status === 'sending' && Boolean(staleLockedAt) && staleLockedAt <= staleLockBefore

  if (row.status === 'sending' && !isStaleSending) {
    console.info('[human-handoff:deliver] Hand-off already in progress', {
      requestId: row.id,
      clinicSlug: input.clinicSlug,
      runner,
      lockedAt: row.locked_at,
      lockedBy: row.locked_by,
    })
    return { delivered: false, reason: 'in_progress' as const }
  }

  const nowIso = new Date().toISOString()
  const claimPayload = {
    status: 'sending' as HumanHandoffStatus,
    attempt_count: row.attempt_count + 1,
    last_attempt_at: nowIso,
    last_error: null,
    locked_at: nowIso,
    locked_by: runner,
    available_at: nowIso,
  }

  const claimChain = adminClient
    .from('human_handoff_requests')
    .update(claimPayload)
    .eq('id', row.id)

  const claimedQuery = isStaleSending
    ? claimChain.eq('status', 'sending').eq('locked_at', staleLockedAt)
    : claimChain.in('status', ['queued', 'failed'])

  const { data: claimed, error: claimError } = await claimedQuery
    .select(HANDOFF_SELECT_COLUMNS)
    .maybeSingle()

  if (claimError) {
    console.error('[human-handoff:deliver] Failed to claim handoff request', {
      requestId: row.id,
      clinicSlug: input.clinicSlug,
      runner,
      error: claimError.message,
    })
    throw claimError
  }

  if (!claimed) {
    console.info('[human-handoff:deliver] Another worker claimed the request first', {
      requestId: row.id,
      clinicSlug: input.clinicSlug,
      runner,
    })
    return { delivered: false, reason: 'claimed_elsewhere' as const }
  }

  const claimedRow = claimed as unknown as HumanHandoffRequestRow

  try {
    const result = await sendHumanHandoffEmail({
      handoff: claimedRow,
      clinicName: input.clinicName,
      clinicSlug: input.clinicSlug,
      dashboardUrl: input.dashboardUrl,
    })

    const acceptedAt = new Date().toISOString()
    const { error: sentUpdateError } = await adminClient
      .from('human_handoff_requests')
      .update({
        status: 'accepted',
        provider_message_id: result.messageId,
        sent_at: acceptedAt,
        provider_accepted_at: acceptedAt,
        provider_last_event: result.sendPaused ? 'api.accepted_paused' : 'api.accepted',
        provider_last_event_at: acceptedAt,
        last_error: null,
        locked_at: null,
        locked_by: null,
      })
      .eq('id', claimedRow.id)

    if (sentUpdateError) {
      console.error('[human-handoff:deliver] Email accepted by MailerSend but status update failed', {
        requestId: claimedRow.id,
        clinicSlug: input.clinicSlug,
        runner,
        error: sentUpdateError instanceof Error ? sentUpdateError.message : String(sentUpdateError),
        messageId: result.messageId,
      })
      return { delivered: true, reason: 'sent_state_update_failed' as const, messageId: result.messageId }
    }

    console.info('[human-handoff:deliver] Human handoff email accepted by MailerSend', {
      requestId: claimedRow.id,
      clinicSlug: input.clinicSlug,
      runner,
      messageId: result.messageId,
      sendPaused: result.sendPaused,
      warningCount: result.warnings.length,
    })

    return { delivered: true, reason: 'sent' as const, messageId: result.messageId }
  } catch (error) {
    const retryable = isRetryableHumanHandoffError(error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const shouldRetry = retryable && claimedRow.attempt_count < HUMAN_HANDOFF_MAX_ATTEMPTS
    const nextStatus: HumanHandoffStatus = shouldRetry ? 'queued' : 'failed'

    console.error('[human-handoff:deliver] Human handoff delivery failed', {
      requestId: claimedRow.id,
      clinicSlug: input.clinicSlug,
      runner,
      retryable,
      shouldRetry,
      attemptCount: claimedRow.attempt_count,
      error: errorMessage,
    })

    const { error: updateError } = await adminClient
      .from('human_handoff_requests')
      .update({
        status: nextStatus,
        attempt_count: shouldRetry ? claimedRow.attempt_count : HUMAN_HANDOFF_MAX_ATTEMPTS,
        last_error: errorMessage,
        available_at: shouldRetry ? getHumanHandoffNextAvailableAt(claimedRow.attempt_count) : nowIso,
        locked_at: null,
        locked_by: null,
      })
      .eq('id', claimedRow.id)

    if (updateError) {
      console.error('[human-handoff:deliver] Failed to persist delivery failure state', {
        requestId: claimedRow.id,
        clinicSlug: input.clinicSlug,
        runner,
        error: updateError.message,
      })
      throw updateError
    }

    return { delivered: false, reason: shouldRetry ? 'retryable_error' as const : 'terminal_error' as const }
  }
}

export { resolveHumanHandoffRecipients }
