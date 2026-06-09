import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const MAX_SESSIONS_PER_USER = 5

// --------------- Session identifier extraction ---------------

/**
 * Extract the stable `session_id` claim from a Supabase access token (JWT).
 *
 * Supabase Auth issues a `session_id` UUID claim that uniquely identifies a
 * session for its entire lifetime (it does NOT rotate on refresh, unlike the
 * refresh_token). This makes it the correct key for a device/session registry.
 *
 * This function only decodes the JWT payload; it does NOT verify the signature.
 * Signature verification is Supabase Auth's responsibility — we receive the
 * token from a trusted, freshly-created session (signInWithPassword / signUp),
 * so we trust its contents at this point.
 *
 * Reference: https://supabase.com/docs/guides/auth/sessions
 *   "Every access token contains a `session_id` claim, a UUID, uniquely
 *    identifying the session of the user."
 */
export function extractSessionId(accessToken: string | null | undefined): string | null {
  if (!accessToken || typeof accessToken !== 'string') {
    return null
  }

  const parts = accessToken.split('.')
  if (parts.length !== 3) {
    console.warn('[security:extractSessionId] access token is not a 3-part JWT', {
      partCount: parts.length,
    })
    return null
  }

  try {
    // base64url -> base64 -> JSON. Node's Buffer handles padding.
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson) as { session_id?: unknown }

    const sessionId = payload?.session_id
    if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
      return sessionId.trim()
    }

    console.warn('[security:extractSessionId] JWT payload has no usable session_id claim')
    return null
  } catch (error) {
    console.error('[security:extractSessionId] failed to decode access token', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
])

// --------------- Rate limit types (shared) ---------------

export interface BucketResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Note: A per-user in-process token-refresh lock was removed intentionally.
// Supabase Auth already deduplicates concurrent refreshes server-side via its
// 10-second refresh-token reuse interval (see Sessions docs), so an in-process
// lock would add complexity for marginal benefit.

// --------------- Session Registry (Items 24, 26) ---------------

export interface SessionInfo {
  sessionId: string
  ip: string
  userAgent: string
  createdAt: number
}

function normalizeSessionId(sessionId: string): string {
  return sessionId.trim()
}

function normalizeSessionText(value: string, fallback: string, maxLength: number): string {
  const trimmed = value.trim()
  const normalized = trimmed.length > 0 ? trimmed : fallback
  return normalized.slice(0, maxLength)
}

/**
 * Register a new session for a user in shared Postgres storage.
 * The database function evicts old sessions so every instance sees the same limit.
 */
export async function registerSession(
  userId: string,
  sessionId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  const admin = createSupabaseAdminClient()
  const normalizedSessionId = normalizeSessionId(sessionId)

  if (!normalizedSessionId) {
    console.warn('[security:registerSession] skipping empty session key', { userId })
    return
  }

  const { error } = await admin.rpc('register_user_session', {
    p_user_id: userId,
    p_session_key: normalizedSessionId,
    p_ip: normalizeSessionText(ip, 'unknown', 128),
    p_user_agent: normalizeSessionText(userAgent, 'unknown', 512),
    p_max_sessions: MAX_SESSIONS_PER_USER,
  })

  if (error) {
    console.error('[security:registerSession] failed to persist session', {
      userId,
      error: error.message,
    })
  }
}

export async function unregisterSession(_userId: string, _sessionId: string): Promise<void> {
  // Deprecated: per-session logout is handled by clearUserSessions (global)
  // via supabase.auth.signOut(). Kept as a no-op stub for backward compat;
  // new code should not call this.
  console.warn('[security:unregisterSession] deprecated no-op; use clearUserSessions')
}

export async function clearUserSessions(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('[security:clearUserSessions] failed to clear user sessions', {
      userId,
      error: error.message,
    })
  }
}

// --------------- Safe Logging ---------------

/**
 * Strip sensitive fields from an object before logging.
 * Recursively removes keys like password, token, secret, etc.
 */
export function sanitizeForLogging(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging)
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeForLogging(value)
      }
    }
    return sanitized
  }

  return obj
}

/**
 * Safely log an error without leaking sensitive data.
 * Use this instead of console.error(error) in API routes.
 */
export function safeErrorLog(context: string, error: unknown): void {
  const sanitized = sanitizeForLogging(error)
  console.error(`[${context}]`, sanitized)
}

// --------------- Origin & IP helpers ---------------

export function assertSameOrigin(originHeader: string | null | undefined, nextUrl: URL) {
  const originValue = typeof originHeader === 'string' ? originHeader.trim() : ''

  if (!originValue) {
    throw new Error('Origin header missing')
  }

  let parsedOrigin: string
  try {
    parsedOrigin = new URL(originValue).origin
  } catch {
    throw new Error('Origin mismatch')
  }

  if (parsedOrigin !== nextUrl.origin) {
    throw new Error('Origin mismatch')
  }
}

export function getClientIp(headers: Headers): string {
  // Vercel sets x-vercel-forwarded-for with the true client IP and
  // overwrites x-forwarded-for to prevent spoofing.  When running
  // behind an additional CDN (Cloudflare, etc.), x-vercel-forwarded-for
  // preserves the original value.
  // Ref: https://vercel.com/docs/headers/request-headers
  const vercelForwarded = headers.get('x-vercel-forwarded-for')
  if (vercelForwarded) {
    const firstIp = vercelForwarded
      .split(',')
      .map((part) => part.trim())
      .find(Boolean)

    if (firstIp) {
      console.info('[security:getClientIp] resolved from x-vercel-forwarded-for', { ip: firstIp })
      return firstIp
    }
  }

  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const firstIp = xForwardedFor
      .split(',')
      .map((part) => part.trim())
      .find(Boolean)

    if (firstIp) {
      return firstIp
    }
  }

  const fallbackHeaders = ['x-real-ip', 'cf-connecting-ip'] as const
  for (const header of fallbackHeaders) {
    const value = headers.get(header)?.trim()
    if (value) {
      return value
    }
  }

  console.warn('[security:getClientIp] no IP headers found, returning unknown')
  return 'unknown'
}
