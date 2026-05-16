import 'server-only'

/**
 * In-memory widget rate limiter.
 * Uses per-process sliding window counters keyed by identifier.
 *
 * For multi-instance production, replace with Upstash Redis.
 * The interface stays the same — only the backing store changes.
 */

interface RateBucket {
  timestamps: number[]
}

interface RateLimitState {
  buckets: Map<string, RateBucket>
}

const globalForWidgetRate = globalThis as typeof globalThis & {
  __widgetRateLimitState__?: RateLimitState
}

const state: RateLimitState =
  globalForWidgetRate.__widgetRateLimitState__ ?? {
    buckets: new Map(),
  }

globalForWidgetRate.__widgetRateLimitState__ = state

export interface WidgetRateLimitConfig {
  /** Unique key for this limit (e.g., "widget-config:ip:1.2.3.4"). */
  key: string
  /** Max requests allowed in the window. */
  limit: number
  /** Window size in milliseconds. */
  windowMs: number
}

export interface WidgetRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check (and record) a widget rate limit.
 * Returns whether the request is allowed and remaining capacity.
 */
export function checkWidgetRateLimit(
  config: WidgetRateLimitConfig,
  now: number = Date.now(),
): WidgetRateLimitResult {
  const bucket = state.buckets.get(config.key) ?? { timestamps: [] }

  // Remove expired entries
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < config.windowMs)

  const allowed = bucket.timestamps.length < config.limit

  if (allowed) {
    bucket.timestamps.push(now)
  }

  state.buckets.set(config.key, bucket)

  const remaining = Math.max(0, config.limit - bucket.timestamps.length)
  const resetAt =
    bucket.timestamps.length > 0
      ? bucket.timestamps[0] + config.windowMs
      : now + config.windowMs

  return { allowed, remaining, resetAt }
}

/** Clear all widget rate limit state (for testing). */
export function clearWidgetRateLimitState(): void {
  state.buckets.clear()
}

// ─── Preset limits ─────────────────────────────────────────────

/** Config bootstrap: 30 requests per IP per minute. */
export function widgetConfigRateKey(ip: string): WidgetRateLimitConfig {
  return { key: `widget-config:${ip}`, limit: 30, windowMs: 60_000 }
}

/** Chat messages: 20 per visitor+IP per minute. */
export function widgetChatRateKey(visitorId: string, ip: string): WidgetRateLimitConfig {
  return { key: `widget-chat:${visitorId}:${ip}`, limit: 20, windowMs: 60_000 }
}

/** Events: 60 per visitor per minute. */
export function widgetEventsRateKey(visitorId: string): WidgetRateLimitConfig {
  return { key: `widget-events:${visitorId}`, limit: 60, windowMs: 60_000 }
}

/** Appointment requests: 5 per visitor+IP per minute. */
export function widgetAppointmentRateKey(visitorId: string, ip: string): WidgetRateLimitConfig {
  return { key: `widget-appt:${visitorId}:${ip}`, limit: 5, windowMs: 60_000 }
}
