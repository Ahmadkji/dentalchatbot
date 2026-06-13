import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env/server', () => ({
  serverEnv: {
    MAILERSEND_API_KEY: 'test-mailersend-key',
    MAILERSEND_FROM_EMAIL: 'handoff@smilewell.example',
    MAILERSEND_FROM_NAME: 'SmileWell',
    MAILERSEND_WEBHOOK_SIGNING_SECRET: 'webhook-secret',
    NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
  },
}))
vi.mock('@/lib/human-handoff/mailersend', () => ({
  sendHumanHandoffEmail: vi.fn(),
}))

import {
  deliverHumanHandoffRequest,
  queueHumanHandoffRequest,
  resolveHumanHandoffRecipients,
} from '@/lib/human-handoff/service'
import { sendHumanHandoffEmail } from '@/lib/human-handoff/mailersend'
import type { HumanHandoffRequestRow } from '@/lib/human-handoff/types'

function createHandoffRow(overrides: Partial<HumanHandoffRequestRow> = {}): HumanHandoffRequestRow {
  return {
    id: 'handoff-1',
    clinic_id: 'clinic-1',
    conversation_id: 'conversation-1',
    lead_id: null,
    trigger_source: 'user_request',
    status: 'queued',
    recipient_emails: ['staff@example.com'],
    visitor_name: 'Alex Patient',
    visitor_email: 'alex@example.com',
    visitor_phone: '+14155550101',
    source_page: 'https://clinic.example.com/contact',
    latest_user_message: 'I want to talk to a human.',
    assistant_message: 'Thanks for your message.',
    summary: 'Visitor asked for human follow-up.',
    provider: 'mailersend',
    provider_message_id: null,
    attempt_count: 0,
    last_attempt_at: null,
    available_at: '2026-06-13T00:00:00.000Z',
    locked_at: null,
    locked_by: null,
    sent_at: null,
    provider_accepted_at: null,
    provider_delivered_at: null,
    provider_last_event: null,
    provider_last_event_at: null,
    last_error: null,
    created_at: '2026-06-13T00:00:00.000Z',
    updated_at: '2026-06-13T00:00:00.000Z',
    ...overrides,
  }
}

function createTableMock(existingRow: HumanHandoffRequestRow | null, savedRow: HumanHandoffRequestRow) {
  let upsertPayload: Record<string, unknown> | null = null
  const table = {
    select: vi.fn(() => table),
    eq: vi.fn(() => table),
    in: vi.fn(() => table),
    maybeSingle: vi.fn(async () => ({ data: existingRow, error: null })),
    upsert: vi.fn((payload: Record<string, unknown>) => {
      upsertPayload = payload
      return table
    }),
    single: vi.fn(async () => ({ data: savedRow, error: null })),
    update: vi.fn(() => table),
    order: vi.fn(() => table),
    limit: vi.fn(() => table),
    lt: vi.fn(() => table),
  }

  return { table, getUpsertPayload: () => upsertPayload }
}

describe('human handoff service', () => {
  const mockedSendHumanHandoffEmail = vi.mocked(sendHumanHandoffEmail)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves clinic recipient emails and ignores duplicates', () => {
    expect(
      resolveHumanHandoffRecipients([
        { key: 'lead_notifications_enabled', value: 'true' },
        { key: 'lead_notification_emails', value: 'staff@example.com, staff@example.com, team@example.com' },
      ]),
    ).toEqual(['staff@example.com', 'team@example.com'])

    expect(
      resolveHumanHandoffRecipients([
        { key: 'lead_notifications_enabled', value: 'false' },
        { key: 'lead_notification_emails', value: 'staff@example.com' },
      ]),
    ).toEqual([])
  })

  it('queues a new human handoff request and keeps the notification snapshot', async () => {
    const savedRow = createHandoffRow({ status: 'queued', recipient_emails: ['staff@example.com', 'team@example.com'] })
    const { table, getUpsertPayload } = createTableMock(null, savedRow)
    const adminClient = {
      from: vi.fn((tableName: string) => {
        if (tableName === 'human_handoff_requests') return table
        throw new Error(`Unexpected table: ${tableName}`)
      }),
    }

    const result = await queueHumanHandoffRequest(adminClient as never, {
      clinicId: 'clinic-1',
      conversationId: 'conversation-1',
      triggerSource: 'user_request',
      visitorName: 'Alex Patient',
      visitorEmail: 'alex@example.com',
      visitorPhone: '+14155550101',
      sourcePage: 'https://clinic.example.com/contact',
      latestUserMessage: 'I need to talk to someone.',
      assistantMessage: 'Thanks for your message.',
      summary: 'Visitor requested a human follow-up.',
      clinicName: 'SmileWell Dental',
      clinicSlug: 'smilewell',
      dashboardUrl: 'https://app.example.com/dashboard/inbox',
      clinicSettings: [
        { key: 'lead_notifications_enabled', value: 'true' },
        { key: 'lead_notification_emails', value: 'staff@example.com, team@example.com' },
      ],
    })

    expect(result.shouldDeliver).toBe(true)
    expect(result.reason).toBeNull()
    expect(result.handoff.status).toBe('queued')
    expect(getUpsertPayload()).toMatchObject({
      clinic_id: 'clinic-1',
      conversation_id: 'conversation-1',
      status: 'queued',
      recipient_emails: ['staff@example.com', 'team@example.com'],
      visitor_email: 'alex@example.com',
      visitor_name: 'Alex Patient',
      attempt_count: 0,
    })
  })

  it('marks a handoff as failed when no recipients are configured', async () => {
    const savedRow = createHandoffRow({ status: 'failed', recipient_emails: [] })
    const { table, getUpsertPayload } = createTableMock(null, savedRow)
    const adminClient = {
      from: vi.fn((tableName: string) => {
        if (tableName === 'human_handoff_requests') return table
        throw new Error(`Unexpected table: ${tableName}`)
      }),
    }

    const result = await queueHumanHandoffRequest(adminClient as never, {
      clinicId: 'clinic-1',
      conversationId: 'conversation-1',
      triggerSource: 'chat_mode',
      visitorName: 'Alex Patient',
      visitorEmail: 'alex@example.com',
      visitorPhone: '+14155550101',
      sourcePage: 'https://clinic.example.com/contact',
      latestUserMessage: 'Hello',
      assistantMessage: 'Thanks for your message.',
      summary: 'Conversation started in human mode.',
      clinicName: 'SmileWell Dental',
      clinicSlug: 'smilewell',
      dashboardUrl: 'https://app.example.com/dashboard/inbox',
      clinicSettings: [
        { key: 'lead_notifications_enabled', value: 'false' },
        { key: 'lead_notification_emails', value: 'staff@example.com' },
      ],
    })

    expect(result.shouldDeliver).toBe(false)
    expect(result.reason).toBe('no_recipients')
    expect(result.handoff.status).toBe('failed')
    expect(getUpsertPayload()).toMatchObject({
      status: 'failed',
      attempt_count: 5,
      recipient_emails: [],
      last_error: 'Human handoff requires lead notifications to stay enabled.',
    })
  })

  it('delivers a queued human handoff request and marks it accepted', async () => {
    const existingRow = createHandoffRow()
    const claimedRow = createHandoffRow({
      status: 'sending',
      attempt_count: 1,
      last_attempt_at: '2026-06-13T00:00:00.000Z',
      locked_at: '2026-06-13T00:00:00.000Z',
      locked_by: 'internal-route',
    })

    const selectChain = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      maybeSingle: vi.fn(async () => ({ data: existingRow, error: null })),
    }
    const claimChain = {
      update: vi.fn(() => claimChain),
      eq: vi.fn(() => claimChain),
      in: vi.fn(() => claimChain),
      select: vi.fn(() => claimChain),
      maybeSingle: vi.fn(async () => ({ data: claimedRow, error: null })),
    }
    const sentChain = {
      update: vi.fn(() => sentChain),
      eq: vi.fn(() => sentChain),
    }

    const adminClient = {
      from: vi
        .fn()
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => claimChain)
        .mockImplementationOnce(() => sentChain),
    }

    mockedSendHumanHandoffEmail.mockResolvedValue({
      messageId: 'message-123',
      status: 202,
      sendPaused: false,
      warnings: [],
    })

    const result = await deliverHumanHandoffRequest(adminClient as never, {
      requestId: 'handoff-1',
      clinicName: 'SmileWell Dental',
      clinicSlug: 'smilewell',
      dashboardUrl: 'https://app.example.com/dashboard/inbox',
    })

    expect(result.delivered).toBe(true)
    expect(result.reason).toBe('sent')
    expect(sendHumanHandoffEmail).toHaveBeenCalledTimes(1)
    expect(sentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        provider_message_id: 'message-123',
      }),
    )
  })
})
