import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────
// Must be before importing the route because of `import 'server-only'` in security.ts

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/route-client', () => ({
  createSupabaseRouteClient: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  assertSameOrigin: vi.fn(),
  clearUserSessions: vi.fn().mockResolvedValue(undefined),
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

import { POST } from '@/app/api/auth/logout/route'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { assertSameOrigin, clearUserSessions } from '@/lib/security'
import { copyResponseCookies } from '@/lib/auth/response'

const mockSignOut = vi.fn()
const mockGetUser = vi.fn()

function mockSupabaseClient() {
  return {
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  }
}

function makeRequest(origin = 'https://example.com') {
  return new NextRequest('https://example.com/api/auth/logout', {
    method: 'POST',
    headers: { origin },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(assertSameOrigin as ReturnType<typeof vi.fn>).mockImplementation(() => {})
  ;(createSupabaseRouteClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabaseClient())
  ;(copyResponseCookies as ReturnType<typeof vi.fn>).mockImplementation((_s: unknown, t: unknown) => t)
})

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('calls signOut() with default scope (global) and returns 200', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockSignOut.mockResolvedValue({ error: null })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockSignOut).toHaveBeenCalledOnce()
    // Default scope is 'global' — no scope argument passed
    expect(mockSignOut).toHaveBeenCalledWith()
  })

  it('captures user ID before calling signOut', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockSignOut.mockResolvedValue({ error: null })

    await POST(makeRequest())

    // getUser called BEFORE signOut
    expect(mockGetUser).toHaveBeenCalledBefore(mockSignOut)
    // clearUserSessions called with the captured user ID
    expect(clearUserSessions).toHaveBeenCalledWith('user-1')
  })

  it('continues gracefully when signOut fails (non-fatal)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockSignOut.mockResolvedValue({
      error: { message: 'Session not found', status: 404 },
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // Still returns 200 — failed signOut is not fatal
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    // Still clears session tracking
    expect(clearUserSessions).toHaveBeenCalledWith('user-1')
  })

  it('handles missing user gracefully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    })
    mockSignOut.mockResolvedValue({ error: null })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    // clearUserSessions NOT called without a user ID
    expect(clearUserSessions).not.toHaveBeenCalled()
  })

  it('returns 403 when origin check fails', async () => {
    ;(assertSameOrigin as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Origin mismatch')
    })

    const response = await POST(makeRequest('https://evil.com'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('Forbidden')
    // Should NOT call signOut if origin check fails
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('returns 500 when supabase client is null', async () => {
    ;(createSupabaseRouteClient as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Auth configuration missing.')
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('copies response cookies from signOut to final response', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockSignOut.mockResolvedValue({ error: null })

    await POST(makeRequest())

    // copyResponseCookies should be called to propagate cleared auth cookies
    expect(copyResponseCookies).toHaveBeenCalledOnce()
  })
})
