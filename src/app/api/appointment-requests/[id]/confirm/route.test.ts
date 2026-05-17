import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireAuthMock = vi.fn()
const getCurrentClinicMock = vi.fn()
const listClinicSettingsMock = vi.fn()
const rpcMock = vi.fn()
const maybeSingleMock = vi.fn()
const eqMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

const buildQuery = () => ({
  select: selectMock,
  eq: eqMock,
  maybeSingle: maybeSingleMock,
})

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: requireAuthMock,
}))

vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinic: getCurrentClinicMock,
}))

vi.mock('@/lib/clinics/settings', () => ({
  listClinicSettings: listClinicSettingsMock,
}))

vi.mock('@/lib/rate-limit-guard', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

describe('appointment confirm route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({
      data: { id: 'request-1' },
      error: null,
    })
    eqMock.mockImplementation(() => buildQuery())
    selectMock.mockImplementation(() => buildQuery())
    fromMock.mockReturnValue(buildQuery())
    requireAuthMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
      error: null,
    })
    getCurrentClinicMock.mockResolvedValue({
      clinic: { id: 'clinic-1' },
    })
    listClinicSettingsMock.mockResolvedValue([
      { key: 'slot_duration', value: '30' },
      { key: 'max_advance_booking', value: '60' },
    ])
  })

  it('rejects invalid request body', async () => {
    const { POST } = await import('@/app/api/appointment-requests/[id]/confirm/route')
    const request = new Request('http://localhost/api/appointment-requests/1/confirm', {
      method: 'POST',
      body: JSON.stringify({ startDate: 'bad-date' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })

    expect(response.status).toBe(400)
  })

  it('maps RPC conflicts to HTTP 409', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    })

    const { POST } = await import('@/app/api/appointment-requests/[id]/confirm/route')
    const request = new Request('http://localhost/api/appointment-requests/1/confirm', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-05-30',
        startTime: '10:30',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })

    expect(response.status).toBe(409)
  })

  it('rejects cross-clinic appointment confirmation before calling the RPC', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    const { POST } = await import('@/app/api/appointment-requests/[id]/confirm/route')
    const request = new Request('http://localhost/api/appointment-requests/1/confirm', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-05-30',
        startTime: '10:30',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })

    expect(response.status).toBe(404)
    expect(rpcMock).not.toHaveBeenCalledWith(
      'confirm_appointment_request',
      expect.anything(),
    )
  })
})
