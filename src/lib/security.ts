import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const MAX_SESSIONS_PER_USER = 5
const TOKEN_REFRESH_LOCK_TTL_MS = 5000

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

// --------------- Token Refresh Lock (Item 23) ---------------

interface RefreshLockState {
  locks: Map<string, number>
}

const globalForRefreshLock = globalThis as typeof globalThis & {
  __refreshLockState__?: RefreshLockState
}

const refreshLockState: RefreshLockState =
  globalForRefreshLock.__refreshLockState__ ?? {
    locks: new Map<string, number>(),
  }

globalForRefreshLock.__refreshLockState__ = refreshLockState

/**
 * Acquire a per-user lock for token refresh.
 * Returns true if the lock was acquired, false if already locked.
 * Locks auto-expire after TOKEN_REFRESH_LOCK_TTL_MS to prevent deadlocks.
 */
export function acquireRefreshLock(userId: string, now: number = Date.now()): boolean {
  const existing = refreshLockState.locks.get(userId)
  if (existing && now - existing < TOKEN_REFRESH_LOCK_TTL_MS) {
    return false
  }
  refreshLockState.locks.set(userId, now)
  return true
}

export function releaseRefreshLock(userId: string): void {
  refreshLockState.locks.delete(userId)
}

export function clearRefreshLockStore() {
  refreshLockState.locks.clear()
}

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

export async function unregisterSession(userId: string, sessionId: string): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('user_sessions')
    .delete()
    .match({
      user_id: userId,
      session_key: normalizeSessionId(sessionId),
    })

  if (error) {
    console.error('[security:unregisterSession] failed to remove session', {
      userId,
      error: error.message,
    })
  }
}

export async function getSessionCount(userId: string): Promise<number> {
  const admin = createSupabaseAdminClient()
  const { count, error } = await admin
    .from('user_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    console.error('[security:getSessionCount] failed to read session count', {
      userId,
      error: error.message,
    })
    return 0
  }

  return count ?? 0
}

export async function clearSessionRegistry(): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('user_sessions').delete()

  if (error) {
    console.error('[security:clearSessionRegistry] failed to clear session registry', {
      error: error.message,
    })
  }
}

/** Clear all sessions for a user from shared storage. */
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
