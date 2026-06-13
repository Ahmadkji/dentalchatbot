import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env/server', () => ({
  serverEnv: {
    MAILERSEND_WEBHOOK_SIGNING_SECRET: 'webhook-secret',
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

import {
  applyMailerSendWebhookEvent,
  getMailerSendWebhookMessageId,
  getMailerSendWebhookSecret,
  verifyMailerSendWebhookSignature,
} from '@/lib/human-handoff/mailersend-webhook'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { HumanHandoffRequestRow } from '@/lib/human-handoff/types'

function createHandoffRow(overrides: Partial<HumanHandoffRequestRow> = {}): HumanHandoffRequestRow {
  return {
    id: 'handoff-1',
    clinic_id: 'clinic-1',
    conversation_id: 'conversation-1',
    lead_id: null,
    trigger_source: 'user_request',
    status: 'accepted',
    recipient_emails: ['staff@example.com'],
    visitor_name: 'Alex Patient',
    visitor_email: 'alex@example.com',
    visitor_phone: '+14155550101',
    source_page: 'https://clinic.example.com/contact',
    latest_user_message: 'I want to talk to a human.',
    assistant_message: 'Thanks for your message.',
    summary: 'Visitor asked for human follow-up.',
    provider: 'mailersend',
    provider_message_id: 'message-123',
    attempt_count: 1,
    last_attempt_at: '2026-06-13T00:00:00.000Z',
    available_at: '2026-06-13T00:00:00.000Z',
    locked_at: null,
    locked_by: null,
    sent_at: '2026-06-13T00:00:30.000Z',
    provider_accepted_at: '2026-06-13T00:00:30.000Z',
    provider_delivered_at: null,
    provider_last_event: 'api.accepted',
    provider_last_event_at: '2026-06-13T00:00:30.000Z',
    last_error: null,
    created_at: '2026-06-13T00:00:00.000Z',
    updated_at: '2026-06-13T00:00:30.000Z',
    ...overrides,
  }
}

describe('mailersend webhook helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies HMAC signatures with the configured webhook secret', () => {
    const rawBody = JSON.stringify({
      type: 'activity.delivered',
      data: { message: { id: 'message-123' } },
    })
    const signature = crypto.createHmac('sha256', 'webhook-secret').update(rawBody).digest('base64')

    expect(
      verifyMailerSendWebhookSignature({
        rawBody,
        signature,
        secret: 'webhook-secret',
      }),
    ).toBe(true)
  })

  it('uses the fixed MailerSend test secret for webhook.test payloads', () => {
    expect(getMailerSendWebhookSecret({ type: 'webhook.test' })).toBe(
      'test_Am3L1GuOIc4blLUuHqAPxxwkZaJyEk8G',
    )
  })

  it('extracts the provider message id from nested payloads', () => {
    expect(
      getMailerSendWebhookMessageId({
        type: 'activity.delivered',
        data: { message: { id: 'message-123' } },
      }),
    ).toBe('message-123')
  })

  it('marks a handoff as delivered when MailerSend sends a delivered event', async () => {
    const selectChain = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      maybeSingle: vi.fn(async () => ({ data: createHandoffRow(), error: null })),
    }
    const updateChain = {
      update: vi.fn(() => updateChain),
      eq: vi.fn(async () => ({ error: null })),
    }

    ;(createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi
        .fn()
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => updateChain),
    })

    const result = await applyMailerSendWebhookEvent({
      eventName: 'activity.delivered',
      messageId: 'message-123',
    })

    expect(result).toMatchObject({ updated: true, status: 'delivered' })
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'delivered',
        provider_last_event: 'activity.delivered',
      }),
    )
  })
})
