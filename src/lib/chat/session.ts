import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

/**
 * Mint a new opaque session token for public widget conversations.
 * The raw token is sent to the browser in a cookie.
 * The SHA-256 hash is stored in conversations.public_token_hash.
 */
export function mintSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Hash a session token for storage in the database.
 * We store only the hash so that a DB leak does not reveal
 * the raw tokens needed to hijack sessions.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Cookie name for the public chat session token. */
export const CHAT_SESSION_COOKIE = 'chat_s'

/** Max age for the chat session cookie (30 days). */
export const CHAT_SESSION_MAX_AGE = 30 * 24 * 60 * 60

/** Cookie path scope. */
export const CHAT_SESSION_PATH = '/'

export type ChatPathType = 'public' | 'preview' | 'dashboard'

export function resolveChatPathType(input: {
  clinicId?: string | null
  clinicSlug?: string | null
  preview?: boolean
}): ChatPathType {
  if (input.preview) {
    return 'preview'
  }

  if (input.clinicId || input.clinicSlug) {
    return 'public'
  }

  return 'dashboard'
}

export function getChatSessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  const isProduction = nodeEnv === 'production'

  return {
    httpOnly: true,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    secure: isProduction,
    maxAge: CHAT_SESSION_MAX_AGE,
    path: CHAT_SESSION_PATH,
  }
}

/** Token expiry interval for new public conversations (30 days). */
export const TOKEN_EXPIRY_INTERVAL = '30 days'
