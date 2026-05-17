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

interface SessionRegistryState {
  sessions: Map<string, SessionInfo[]>
}

const globalForSessionRegistry = globalThis as typeof globalThis & {
  __sessionRegistryState__?: SessionRegistryState
}

const sessionRegistryState: SessionRegistryState =
  globalForSessionRegistry.__sessionRegistryState__ ?? {
    sessions: new Map<string, SessionInfo[]>(),
  }

globalForSessionRegistry.__sessionRegistryState__ = sessionRegistryState

/**
 * Register a new session for a user.
 * If the user already has MAX_SESSIONS_PER_USER sessions, the oldest is evicted.
 */
export function registerSession(
  userId: string,
  sessionId: string,
  ip: string,
  userAgent: string,
  now: number = Date.now()
): void {
  const existing = sessionRegistryState.sessions.get(userId) ?? []
  const updated = existing.filter((s) => s.sessionId !== sessionId)
  updated.push({ sessionId, ip, userAgent, createdAt: now })

  // Evict oldest sessions if over limit
  while (updated.length > MAX_SESSIONS_PER_USER) {
    updated.shift()
  }

  sessionRegistryState.sessions.set(userId, updated)
}

export function unregisterSession(userId: string, sessionId: string): void {
  const existing = sessionRegistryState.sessions.get(userId)
  if (!existing) return
  const updated = existing.filter((s) => s.sessionId !== sessionId)
  if (updated.length === 0) {
    sessionRegistryState.sessions.delete(userId)
  } else {
    sessionRegistryState.sessions.set(userId, updated)
  }
}

export function getSessionCount(userId: string): number {
  return sessionRegistryState.sessions.get(userId)?.length ?? 0
}

export function clearSessionRegistry() {
  sessionRegistryState.sessions.clear()
}

/** Clear all sessions for a user from the in-memory registry. */
export function clearUserSessions(userId: string): void {
  sessionRegistryState.sessions.delete(userId)
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

  return 'unknown'
}
