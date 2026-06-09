import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/route-client', () => ({
  createSupabaseRouteClient: vi.fn(),
}))

vi.mock('@/lib/auth/response', () => ({
  copyResponseCookies: vi.fn((_source, target) => target),
  setPrivateNoStore: vi.fn((response) => response),
}))

vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinic: vi.fn(),
}))

vi.mock('@/lib/supabase/config', () => ({
  getSupabaseAuthConfig: vi.fn(() => ({
    url: 'https://test.supabase.co',
    publishableKey: 'test-key',
  })),
}))

vi.mock('@/lib/security', () => ({
  extractSessionId: vi.fn(() => 'test-session-id'),
  getClientIp: vi.fn(() => '127.0.0.1'),
  registerSession: vi.fn().mockResolvedValue(undefined),
}))

import { GET } from '@/app/auth/callback/route'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { getCurrentClinic } from '@/lib/clinics/current'

const mockExchangeCodeForSession = vi.fn()

function mockSupabaseClient() {
  return {
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  }
}

function makeCallbackRequest(searchParams: Record<string, string>) {
  const url = new URL('https://example.com/auth/callback')
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value)
  }
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(createSupabaseRouteClient as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockSupabaseClient()
  )
})

// ── OAuth error param handling (RFC 6749 §4.1.2.1) ─────────────────────

describe('GET /auth/callback — OAuth provider error params', () => {
  it('redirects to /login?error=oauth-denied when error=access_denied', async () => {
    const request = makeCallbackRequest({
      error: 'access_denied',
      error_description: 'User denied consent',
    })

    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/login?error=oauth-denied')
    // Should NOT attempt code exchange when there is an error param
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects to /login?error=oauth-error for any other OAuth error', async () => {
    const request = makeCallbackRequest({
      error: 'server_error',
      error_description: 'Internal error',
    })

    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/login?error=oauth-error')
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('logs the OAuth error and description to console.error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = makeCallbackRequest({
      error: 'access_denied',
      error_description: 'User closed popup',
    })

    await GET(request)

    expect(errorSpy).toHaveBeenCalledWith(
      '[auth:callback] OAuth provider returned an error',
      expect.objectContaining({
        error: 'access_denied',
        description: 'User closed popup',
      })
    )
    errorSpy.mockRestore()
  })
})

// ── Missing code param ──────────────────────────────────────────────────

describe('GET /auth/callback — missing code param', () => {
  it('redirects to /login?error=auth-callback when no code and no error', async () => {
    const request = makeCallbackRequest({})

    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/login?error=auth-callback')
  })

  it('does not call exchangeCodeForSession without a code', async () => {
    const request = makeCallbackRequest({})

    await GET(request)

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })
})

// ── Code exchange failure ───────────────────────────────────────────────

describe('GET /auth/callback — code exchange failures', () => {
  it('redirects to /login?error=auth-callback when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid code', status: 400 },
    })

    const request = makeCallbackRequest({ code: 'bad-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/login?error=auth-callback')
  })

  it('redirects to /login?error=auth-callback when no user after exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })

    const request = makeCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/login?error=auth-callback')
  })
})

// ── Onboarding redirect ─────────────────────────────────────────────────

describe('GET /auth/callback — onboarding redirect', () => {
  it('redirects to /onboarding when profile is incomplete', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'fake-token' } },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { onboarding_completed: false, default_clinic_id: null },
      clinic: null,
    })

    const request = makeCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/onboarding')
  })

  it('redirects to /onboarding when getCurrentClinic throws', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'fake-token' } },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB error')
    )

    const request = makeCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/onboarding')
  })
})

// ── Happy path ──────────────────────────────────────────────────────────

describe('GET /auth/callback — success redirect', () => {
  it('redirects to next path when fully onboarded', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'fake-token' } },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { onboarding_completed: true, default_clinic_id: 'clinic-1' },
      clinic: { id: 'clinic-1' },
    })

    const request = makeCallbackRequest({
      code: 'valid-code',
      next: '/dashboard',
    })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/dashboard')
  })

  it('redirects to /dashboard when next is /onboarding but user is already onboarded', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'fake-token' } },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { onboarding_completed: true, default_clinic_id: 'clinic-1' },
      clinic: { id: 'clinic-1' },
    })

    const request = makeCallbackRequest({
      code: 'valid-code',
      next: '/onboarding',
    })
    const response = await GET(request)

    const location = response.headers.get('location') || ''
    expect(location).toContain('/dashboard')
    expect(location).not.toMatch(/\/onboarding$/)
  })
})

// ── Session registration (OAuth/email-confirmation) ─────────────────────

describe('GET /auth/callback — session registration', () => {
  it('registers session after successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'fake-token' } },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { onboarding_completed: true, default_clinic_id: 'clinic-1' },
      clinic: { id: 'clinic-1' },
    })

    const { registerSession } = await import('@/lib/security')
    const request = makeCallbackRequest({ code: 'valid-code' })
    await GET(request)

    expect(registerSession).toHaveBeenCalledWith(
      'user-1',
      'test-session-id',
      '127.0.0.1',
      expect.any(String)
    )
  })

  it('continues gracefully when registerSession throws (non-fatal)', async () => {
    const { registerSession } = await import('@/lib/security')
    ;(registerSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB connection failed')
    )
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'fake-token' } },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { onboarding_completed: true, default_clinic_id: 'clinic-1' },
      clinic: { id: 'clinic-1' },
    })

    const request = makeCallbackRequest({ code: 'valid-code' })
    const response = await GET(request)

    // Should still redirect to dashboard despite session registration failure
    expect(response.status).toBe(307)
    const location = response.headers.get('location') || ''
    expect(location).toContain('/dashboard')
  })

  it('does not call registerSession when no session is returned', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    })
    ;(getCurrentClinic as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { onboarding_completed: true, default_clinic_id: 'clinic-1' },
      clinic: { id: 'clinic-1' },
    })

    const { registerSession } = await import('@/lib/security')
    const request = makeCallbackRequest({ code: 'valid-code' })
    await GET(request)

    expect(registerSession).not.toHaveBeenCalled()
  })
})
