const DEFAULT_LIMIT = 5
const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const API_RATE_LIMIT = 100
const API_RATE_WINDOW_MS = 15 * 60 * 1000
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

type BucketKind = 'email' | 'ip'

interface BucketResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export interface RateLimitInput {
  email?: string | null
  ip?: string | null
  limit?: number
  windowMs?: number
  now?: number
}

interface RateLimitState {
  buckets: Map<string, number[]>
}

const globalForRateLimit = globalThis as typeof globalThis & {
  __authRateLimitState__?: RateLimitState
}

const rateLimitState: RateLimitState =
  globalForRateLimit.__authRateLimitState__ ?? {
    buckets: new Map<string, number[]>(),
  }

globalForRateLimit.__authRateLimitState__ = rateLimitState

function getBucketKey(kind: BucketKind, value: string): string {
  return `${kind}:${value.trim().toLowerCase()}`
}

function getBucketResult(
  key: string,
  now: number,
  limit: number,
  windowMs: number
): BucketResult {
  const existing = rateLimitState.buckets.get(key) ?? []
  const fresh = existing.filter((timestamp) => now - timestamp < windowMs)
  const allowed = fresh.length < limit

  if (allowed) {
    fresh.push(now)
    rateLimitState.buckets.set(key, fresh)
  } else {
    rateLimitState.buckets.set(key, fresh)
  }

  const remaining = Math.max(0, limit - fresh.length)
  const resetAt = fresh.length > 0 ? fresh[0] + windowMs : now + windowMs

  return { allowed, remaining, resetAt }
}

export function clearAuthRateLimitStore() {
  rateLimitState.buckets.clear()
}

// --------------- Global API Rate Limiting (Item 19) ---------------

interface ApiBucketState {
  buckets: Map<string, number[]>
}

const globalForApiRateLimit = globalThis as typeof globalThis & {
  __apiRateLimitState__?: ApiBucketState
}

const apiRateLimitState: ApiBucketState =
  globalForApiRateLimit.__apiRateLimitState__ ?? {
    buckets: new Map<string, number[]>(),
  }

globalForApiRateLimit.__apiRateLimitState__ = apiRateLimitState

export function checkApiRateLimit(
  ip: string,
  limit: number = API_RATE_LIMIT,
  windowMs: number = API_RATE_WINDOW_MS,
  now: number = Date.now()
): BucketResult {
  const key = `api:${ip}`
  const existing = apiRateLimitState.buckets.get(key) ?? []
  const fresh = existing.filter((timestamp) => now - timestamp < windowMs)
  const allowed = fresh.length < limit

  if (allowed) {
    fresh.push(now)
  }
  apiRateLimitState.buckets.set(key, fresh)

  const remaining = Math.max(0, limit - fresh.length)
  const resetAt = fresh.length > 0 ? fresh[0] + windowMs : now + windowMs

  return { allowed, remaining, resetAt }
}

export function clearApiRateLimitStore() {
  apiRateLimitState.buckets.clear()
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

// --------------- Safe Logging (Item 29) ---------------

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

// --------------- Auth Rate Limiting (existing) ---------------

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

export function checkAuthRateLimit({
  email,
  ip,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
  now = Date.now(),
}: RateLimitInput) {
  const targets: BucketResult[] = []

  if (typeof email === 'string' && email.trim()) {
    targets.push(getBucketResult(getBucketKey('email', email), now, limit, windowMs))
  }

  if (typeof ip === 'string' && ip.trim() && ip !== 'unknown') {
    targets.push(getBucketResult(getBucketKey('ip', ip), now, limit, windowMs))
  }

  if (targets.length === 0) {
    return {
      allowed: true,
      remaining: limit,
      resetAt: now + windowMs,
    }
  }

  return {
    allowed: targets.every((target) => target.allowed),
    remaining: Math.min(...targets.map((target) => target.remaining)),
    resetAt: Math.min(...targets.map((target) => target.resetAt)),
  }
}
