import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinic: vi.fn(),
}))
vi.mock('@/lib/clinics/settings', () => ({
  CLINIC_SETTING_DEFAULTS: [],
  listClinicSettings: vi.fn(),
  mapLeadSettings: vi.fn(),
  normalizeLeadSettingsInput: vi.fn(),
}))

import { PUT } from '@/app/api/lead-settings/route'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { listClinicSettings, normalizeLeadSettingsInput } from '@/lib/clinics/settings'

function makeRequest(settings: Record<string, unknown>) {
  return new NextRequest('https://app.example.com/api/lead-settings', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ settings }),
  })
}

describe('PUT /api/lead-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      clinic: { id: 'clinic-1' },
      membership: { role: 'owner' },
    })
    ;(listClinicSettings as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'chat_mode', value: 'human' },
      { key: 'lead_notifications_enabled', value: 'true' },
      { key: 'lead_notification_emails', value: 'staff@example.com' },
    ])
  })

  it('rejects removing notification recipients while human mode is enabled', async () => {
    ;(normalizeLeadSettingsInput as ReturnType<typeof vi.fn>).mockReturnValue({
      lead_notifications_enabled: 'false',
      lead_notification_emails: '',
    })

    const response = await PUT(
      makeRequest({
        notifications_enabled: 'false',
        notification_emails: '',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Human handoff requires lead notifications to stay enabled.',
    })
  })
})
