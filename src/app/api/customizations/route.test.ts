import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinic: vi.fn(),
}))
vi.mock('@/lib/human-handoff/config', () => ({
  getHumanHandoffDeliveryConfiguration: vi.fn(),
}))

import { PUT } from '@/app/api/customizations/route'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { getHumanHandoffDeliveryConfiguration } from '@/lib/human-handoff/config'

function makeRequest(settings: Record<string, unknown>) {
  return new NextRequest('https://app.example.com/api/customizations', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ settings }),
  })
}

describe('PUT /api/customizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {
        from: vi.fn(() => {
          const chain = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            in: vi.fn(async () => ({
              data: [
                { key: 'lead_notifications_enabled', value: 'false' },
                { key: 'lead_notification_emails', value: '' },
              ],
              error: null,
            })),
          }
          return chain
        }),
      },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      clinic: { id: 'clinic-1' },
      membership: { role: 'owner' },
    })
  })

  it('rejects human mode when human handoff delivery is not ready', async () => {
    ;(getHumanHandoffDeliveryConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
      ready: false,
      reason: 'no_recipients',
      message: 'Human handoff requires at least one notification recipient email.',
    })

    const response = await PUT(
      makeRequest({
        fallback_message: 'Fallback',
        chat_mode: 'human',
        collect_user_details: 'optional',
        disable_smart_followup: false,
        smart_followup_count: 3,
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Human handoff requires at least one notification recipient email.',
    })
  })
})
