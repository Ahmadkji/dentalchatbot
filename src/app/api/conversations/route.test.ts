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

import { GET } from '@/app/api/conversations/route'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      clinic: { id: 'clinic-1' },
    })
  })

  it('includes human handoff summary fields in the list payload', async () => {
    const conversationsChain = {
      select: vi.fn(() => conversationsChain),
      eq: vi.fn(() => conversationsChain),
      order: vi.fn(() => conversationsChain),
      limit: vi.fn(async () => ({
        data: [
          {
            id: 'conversation-1',
            visitor_name: 'Alex Patient',
            channel: 'widget',
            status: 'pending',
            subject: 'Need help',
            message_count: 3,
            last_message: 'A human will follow up shortly.',
            source_page: 'https://clinic.example.com/contact',
            helpful_status: 'unreviewed',
            needs_improvement: false,
            lead_captured: true,
            appointment_requested: false,
            created_at: '2026-06-13T00:00:00.000Z',
            updated_at: '2026-06-13T00:01:00.000Z',
          },
        ],
        error: null,
        count: 1,
      })),
    }

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: vi.fn((table: string) => {
          if (table === 'conversations') return conversationsChain
          throw new Error(`Unexpected table: ${table}`)
        }),
      },
      error: null,
    })

    const eventsChain = {
      select: vi.fn(() => eventsChain),
      in: vi.fn(async () => ({ data: [{ conversation_id: 'conversation-1', event_type: 'call_click' }], error: null })),
    }
    const handoffChain = {
      select: vi.fn(() => handoffChain),
      in: vi.fn(async () => ({
        data: [
          {
            conversation_id: 'conversation-1',
            status: 'accepted',
            trigger_source: 'user_request',
            attempt_count: 1,
            last_error: null,
            provider_accepted_at: '2026-06-13T00:01:10.000Z',
            provider_delivered_at: null,
            sent_at: '2026-06-13T00:01:10.000Z',
          },
        ],
        error: null,
      })),
    }

    ;(createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'interaction_events') return eventsChain
        if (table === 'human_handoff_requests') return handoffChain
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await GET(new NextRequest('https://app.example.com/api/conversations'))

    expect(response.status).toBe(200)
    const body = await response.json() as { conversations: Array<Record<string, unknown>> }
    expect(body.conversations[0]).toMatchObject({
      id: 'conversation-1',
      humanHandoffStatus: 'accepted',
      humanHandoffTriggerSource: 'user_request',
      humanHandoffAttemptCount: 1,
      humanHandoffAcceptedAt: '2026-06-13T00:01:10.000Z',
      humanHandoffDeliveredAt: null,
      callClicks: 1,
    })
  })
})
