import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/route-client', () => ({
  createSupabaseRouteClient: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  assertSameOrigin: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  consumeDistributedRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 2,
    resetAt: Date.now() + 15 * 60 * 1000,
  }),
}))

vi.mock('@/lib/auth/response', () => ({
  copyResponseCookies: vi.fn((_source, target) => target),
  setPrivateNoStore: vi.fn((response) => response),
}))

vi.mock('@/lib/supabase/config', () => ({
  getSupabaseAuthConfig: vi.fn(() => ({
    url: 'https://test.supabase.co',
    publishableKey: 'test-key',
  })),
}))

import { POST } from '@/app/api/auth/onboarding/route'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { assertSameOrigin } from '@/lib/security'
import { consumeDistributedRateLimit } from '@/lib/rate-limit'
import { copyResponseCookies } from '@/lib/auth/response'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

function mockSupabaseClient() {
  return {
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
  }
}

function makeRequest(body: Record<string, unknown>, origin = 'https://example.com') {
  return new NextRequest('https://example.com/api/auth/onboarding', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const validPayload = {
  fullName: 'Dr. John Smith',
  clinicName: 'Smile Dental Clinic',
  country: 'United States',
  city: 'New York',
  timezone: 'America/New_York',
  phone: '+12125551234',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(assertSameOrigin as ReturnType<typeof vi.fn>).mockImplementation(() => {})
  ;(createSupabaseRouteClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabaseClient())
  ;(copyResponseCookies as ReturnType<typeof vi.fn>).mockImplementation((_s: unknown, t: unknown) => t)
  ;(consumeDistributedRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
    allowed: true,
    remaining: 2,
    resetAt: Date.now() + 15 * 60 * 1000,
  })
})

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/onboarding', () => {
  it('calls getUser() only once (no double call)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({ data: { clinic_id: 'clinic-1' }, error: null })

    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(200)

    // getUser should be called exactly once inside requireSession
    expect(mockGetUser).toHaveBeenCalledOnce()
  })

  it('uses user from requireSession for rate limit and RPC', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({ data: { clinic_id: 'clinic-1' }, error: null })

    await POST(makeRequest(validPayload))

    // Rate limit uses the user ID from requireSession
    expect(consumeDistributedRateLimit).toHaveBeenCalledWith(
      'onboarding:user-1',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Boolean),
    )
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    })

    const response = await POST(makeRequest(validPayload))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Session expired.')
    // Should NOT call RPC if not authenticated
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid payload', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const response = await POST(makeRequest({ fullName: '' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('returns 403 when origin check fails', async () => {
    ;(assertSameOrigin as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Origin mismatch')
    })

    const response = await POST(makeRequest(validPayload, 'https://evil.com'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('Forbidden')
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    ;(consumeDistributedRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 15 * 60 * 1000,
    })

    const response = await POST(makeRequest(validPayload))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toContain('Too many')
  })

  it('calls complete_onboarding RPC with validated data', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({ data: { clinic_id: 'clinic-1' }, error: null })

    const response = await POST(makeRequest(validPayload))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.clinicId).toBe('clinic-1')
    expect(mockRpc).toHaveBeenCalledWith('complete_onboarding', expect.objectContaining({
      p_full_name: 'Dr. John Smith',
      p_clinic_name: 'Smile Dental Clinic',
      p_phone: '+12125551234',
    }))
  })

  it('returns 400 when RPC fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Clinic name already exists', code: '23505' },
    })

    const response = await POST(makeRequest(validPayload))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('returns 500 when supabase client is null', async () => {
    ;(createSupabaseRouteClient as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await POST(makeRequest(validPayload))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Auth configuration missing.')
  })

  it('strips website URL to origin only', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({ data: { clinic_id: 'clinic-1' }, error: null })

    await POST(makeRequest({
      ...validPayload,
      websiteUrl: 'https://smile-dental.com/about?lang=en',
    }))

    expect(mockRpc).toHaveBeenCalledWith('complete_onboarding', expect.objectContaining({
      p_website_url: 'https://smile-dental.com',
    }))
  })
})
