import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinic: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

import { GET } from '@/app/api/conversations/[id]/route'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function makeChain<T>(result: T) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(async () => ({ data: result, error: null })),
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
  }

  return chain
}

describe('GET /api/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      clinic: { id: 'clinic-1' },
    })
  })

  it('includes human handoff status details for the inbox UI', async () => {
    const conversation = {
      id: 'conversation-1',
      visitor_name: 'Alex Patient',
      channel: 'widget',
      status: 'pending',
      subject: 'Need help',
      message_count: 3,
      last_message: 'Thanks, a human will review this shortly.',
      source_page: 'https://clinic.example.com/contact',
      helpful_status: 'unreviewed',
      needs_improvement: false,
      lead_captured: true,
      appointment_requested: false,
      created_at: '2026-06-13T00:00:00.000Z',
      updated_at: '2026-06-13T00:00:00.000Z',
    }
    const messages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'I want to talk to a person',
        created_at: '2026-06-13T00:00:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'A human team member will review this shortly.',
        created_at: '2026-06-13T00:01:00.000Z',
      },
    ]
    const events = [{ event_type: 'call_click' }]
    const humanHandoff = {
      id: 'handoff-1',
      status: 'delivered',
      provider_message_id: 'message-123',
      attempt_count: 1,
      last_error: null,
      sent_at: '2026-06-13T00:01:30.000Z',
      provider_accepted_at: '2026-06-13T00:01:20.000Z',
      provider_delivered_at: '2026-06-13T00:01:30.000Z',
      provider_last_event: 'activity.delivered',
      trigger_source: 'user_request',
      updated_at: '2026-06-13T00:01:30.000Z',
    }

    const conversationLookup = makeChain(conversation)
    const messageLookup = makeChain(messages)
    const eventLookup = {
      select: vi.fn(() => eventLookup),
      eq: vi.fn(async () => ({ data: events, error: null })),
    }
    const handoffLookup = makeChain(humanHandoff)

    ;(createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'conversations') return conversationLookup
        if (table === 'conversation_messages') return messageLookup
        if (table === 'interaction_events') return eventLookup
        if (table === 'human_handoff_requests') return handoffLookup
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await GET(new NextRequest('https://app.example.com/api/conversations/conversation-1'), {
      params: Promise.resolve({ id: 'conversation-1' }),
    })

    expect(response.status).toBe(200)

    const body = await response.json() as {
      id: string
      patientName: string
      humanHandoffStatus: string | null
      humanHandoffTriggerSource: string | null
      humanHandoffProviderMessageId: string | null
      humanHandoffAttemptCount: number
      humanHandoffLastError: string | null
      humanHandoffAcceptedAt: string | null
      humanHandoffDeliveredAt: string | null
      humanHandoffProviderEvent: string | null
      humanHandoffSentAt: string | null
      whatsappClicks: number
      locationClicks: number
      directionsClicks: number
      callClicks: number
      messages: Array<{
        id: string
        role: string
        content: string
        createdAt: string
      }>
    }

    expect(body).toMatchObject({
      id: 'conversation-1',
      patientName: 'Alex Patient',
      humanHandoffStatus: 'delivered',
      humanHandoffTriggerSource: 'user_request',
      humanHandoffProviderMessageId: 'message-123',
      humanHandoffAttemptCount: 1,
      humanHandoffLastError: null,
      humanHandoffAcceptedAt: '2026-06-13T00:01:20.000Z',
      humanHandoffDeliveredAt: '2026-06-13T00:01:30.000Z',
      humanHandoffProviderEvent: 'activity.delivered',
      humanHandoffSentAt: '2026-06-13T00:01:30.000Z',
      whatsappClicks: 0,
      locationClicks: 0,
      directionsClicks: 0,
      callClicks: 1,
    })

    expect(body.messages).toHaveLength(2)
    expect(body.messages[0]).toMatchObject({
      id: 'msg-1',
      role: 'user',
      content: 'I want to talk to a person',
      createdAt: '2026-06-13T00:00:00.000Z',
    })
    expect(body.messages[1]).toMatchObject({
      id: 'msg-2',
      role: 'assistant',
      content: 'A human team member will review this shortly.',
      createdAt: '2026-06-13T00:01:00.000Z',
    })
  })
})
