import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { getClientIp, extractSessionId } from '@/lib/security'

function makeHeaders(headers: Record<string, string>): Headers {
  return new Headers(headers)
}

/** Build a fake JWT (header.payload.signature) with arbitrary claims. */
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fake-signature`
}

describe('getClientIp', () => {
  it('prefers x-vercel-forwarded-for over x-forwarded-for', () => {
    const headers = makeHeaders({
      'x-vercel-forwarded-for': '1.1.1.1',
      'x-forwarded-for': '2.2.2.2',
    })
    expect(getClientIp(headers)).toBe('1.1.1.1')
  })

  it('uses x-forwarded-for when x-vercel-forwarded-for is absent', () => {
    const headers = makeHeaders({
      'x-forwarded-for': '2.2.2.2',
    })
    expect(getClientIp(headers)).toBe('2.2.2.2')
  })

  it('extracts first IP from comma-separated x-vercel-forwarded-for', () => {
    const headers = makeHeaders({
      'x-vercel-forwarded-for': '  3.3.3.3 , 4.4.4.4 ',
    })
    expect(getClientIp(headers)).toBe('3.3.3.3')
  })

  it('falls back to x-real-ip when no forwarded-for headers', () => {
    const headers = makeHeaders({
      'x-real-ip': '5.5.5.5',
    })
    expect(getClientIp(headers)).toBe('5.5.5.5')
  })

  it('falls back to cf-connecting-ip when no other IP headers', () => {
    const headers = makeHeaders({
      'cf-connecting-ip': '6.6.6.6',
    })
    expect(getClientIp(headers)).toBe('6.6.6.6')
  })

  it('returns "unknown" when no IP headers are present', () => {
    const headers = makeHeaders({})
    expect(getClientIp(headers)).toBe('unknown')
  })

  it('returns "unknown" for empty x-forwarded-for', () => {
    const headers = makeHeaders({
      'x-forwarded-for': '  ,  ',
    })
    // Falls through to unknown since only commas/whitespace
    expect(getClientIp(headers)).toBe('unknown')
  })

  it('prefers x-real-ip over cf-connecting-ip', () => {
    const headers = makeHeaders({
      'x-real-ip': '7.7.7.7',
      'cf-connecting-ip': '8.8.8.8',
    })
    expect(getClientIp(headers)).toBe('7.7.7.7')
  })

  it('handles IPv6 addresses', () => {
    const headers = makeHeaders({
      'x-vercel-forwarded-for': '2001:db8:85a3::8a2e:370:7348',
    })
    expect(getClientIp(headers)).toBe('2001:db8:85a3::8a2e:370:7348')
  })
})

// ── extractSessionId ────────────────────────────────────────────────────

describe('extractSessionId', () => {
  it('returns the session_id from a valid JWT', () => {
    const token = makeJwt({
      sub: 'user-123',
      session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      exp: 1899999999,
    })
    expect(extractSessionId(token)).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('trims whitespace from session_id', () => {
    const token = makeJwt({ session_id: '  trimmed-id  ' })
    expect(extractSessionId(token)).toBe('trimmed-id')
  })

  it('returns null for null input', () => {
    expect(extractSessionId(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractSessionId(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractSessionId('')).toBeNull()
  })

  it('returns null for a non-JWT string (no dots)', () => {
    expect(extractSessionId('not-a-jwt')).toBeNull()
  })

  it('returns null for a JWT with only 2 parts', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ session_id: 'test' })).toString('base64url')
    expect(extractSessionId(`${header}.${body}`)).toBeNull()
  })

  it('returns null when session_id is missing from payload', () => {
    const token = makeJwt({ sub: 'user-1', exp: 1899999999 })
    expect(extractSessionId(token)).toBeNull()
  })

  it('returns null when session_id is an empty string', () => {
    const token = makeJwt({ session_id: '' })
    expect(extractSessionId(token)).toBeNull()
  })

  it('returns null when session_id is whitespace only', () => {
    const token = makeJwt({ session_id: '   ' })
    expect(extractSessionId(token)).toBeNull()
  })

  it('returns null when session_id is a number instead of string', () => {
    const token = makeJwt({ session_id: 12345 })
    expect(extractSessionId(token)).toBeNull()
  })

  it('returns null when payload is not valid JSON', () => {
    const header = Buffer.from('{"alg":"HS256"}').toString('base64url')
    // base64url of "not-json" — a syntactically broken payload
    const badPayload = Buffer.from('not-json').toString('base64url')
    expect(extractSessionId(`${header}.${badPayload}.sig`)).toBeNull()
  })

  it('handles a realistic Supabase JWT structure', () => {
    const token = makeJwt({
      iss: 'https://test.supabase.co/auth/v1',
      sub: '550e8400-e29b-41d4-a716-446655440000',
      aud: 'authenticated',
      exp: 1899999999,
      iat: 1700000000,
      email: 'test@example.com',
      phone: '',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'password', timestamp: 1700000000 }],
      session_id: '660e8400-e29b-41d4-a716-446655440000',
      is_anonymous: false,
    })
    expect(extractSessionId(token)).toBe('660e8400-e29b-41d4-a716-446655440000')
  })
})
