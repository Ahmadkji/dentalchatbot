import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUserMock = vi.fn()
const currentClinicAiProfileMock = vi.fn()
const searchKnowledgeChunksMock = vi.fn()
const zaiCreateMock = vi.fn()
const verifyWidgetAccessTokenMock = vi.fn()

vi.mock('@/lib/supabase/route-client', () => ({
  createSupabaseRouteClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinicAiProfile: currentClinicAiProfileMock,
}))

vi.mock('@/lib/knowledge/sources', () => ({
  searchKnowledgeChunks: searchKnowledgeChunksMock,
}))

vi.mock('z-ai-web-dev-sdk', () => ({
  default: {
    create: zaiCreateMock,
  },
}))

vi.mock('@/lib/widget/widget-access-token', () => ({
  verifyWidgetAccessToken: verifyWidgetAccessTokenMock,
}))

describe('/api/chat route auth guards', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: null } })
    currentClinicAiProfileMock.mockResolvedValue({ aiProfile: null })
    searchKnowledgeChunksMock.mockResolvedValue([])
    verifyWidgetAccessTokenMock.mockReturnValue(null)
    zaiCreateMock.mockResolvedValue({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })
  })

  it('rejects invalid conversationId format', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'hello',
        conversationId: 'conv-123',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Invalid conversationId/)
  })

  it('rejects unauthenticated dashboard conversation access', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'hello',
        conversationId: '00000000-0000-0000-0000-000000000000',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('rejects legacy public clinicId-only widget requests', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'hello',
        clinicId: '11111111-1111-4111-8111-111111111111',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/clinicSlug/)
  })

  it('rejects public slug widget requests without a widget token', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'hello',
        clinicSlug: 'smile-dental-clinic',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatch(/Widget access token/)
  })

  it('accepts valid slug + widget token without parentOrigin', async () => {
    const { POST } = await import('@/app/api/chat/route')
    verifyWidgetAccessTokenMock.mockReturnValue({
      slug: 'smile-dental-clinic',
      origin: 'https://smiledental.com',
      iat: Date.now(),
      jti: 'abc',
      ttlMs: 300000,
    })

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'hello',
        clinicSlug: 'smile-dental-clinic',
        widgetAccessToken: 'signed-token',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    const response = await POST(request)

       // Should NOT be 403 — parentOrigin is no longer required
    expect(response.status).not.toBe(403)
  })

  it('never accepts clinicId-only public widget access for automation paths', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'book me tomorrow',
        clinicId: '11111111-1111-4111-8111-111111111111',
      }),
      headers: {
        'content-type': 'application/json',
      },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
