import { describe, expect, it } from 'vitest'

import {
  CHAT_SESSION_MAX_AGE,
  CHAT_SESSION_PATH,
  getChatSessionCookieOptions,
  hashSessionToken,
  mintSessionToken,
  resolveChatPathType,
} from '@/lib/chat/session'

describe('chat session helpers', () => {
  it('mints opaque tokens and hashes deterministically', () => {
    const token = mintSessionToken()
    expect(token).toHaveLength(64)
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
    expect(hashSessionToken(token)).not.toBe(token)
  })

  it('uses cross-site safe cookie settings in production', () => {
    expect(getChatSessionCookieOptions('production')).toEqual({
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: CHAT_SESSION_MAX_AGE,
      path: CHAT_SESSION_PATH,
    })
  })

  it('uses local-dev cookie settings outside production', () => {
    expect(getChatSessionCookieOptions('development')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: CHAT_SESSION_MAX_AGE,
      path: CHAT_SESSION_PATH,
    })
  })

  it('classifies public, preview, and dashboard chat paths correctly', () => {
    expect(resolveChatPathType({ clinicId: 'clinic-1', preview: false })).toBe('public')
    expect(resolveChatPathType({ clinicSlug: 'smile-dental', preview: false })).toBe('public')
    expect(resolveChatPathType({ clinicId: 'clinic-1', preview: true })).toBe('preview')
    expect(resolveChatPathType({})).toBe('dashboard')
  })
})
