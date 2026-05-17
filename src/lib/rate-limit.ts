import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

interface RpcRateLimitRow {
  allowed: boolean
  remaining: number
  reset_at: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Consume from a distributed token-bucket rate limit in Postgres.
 *
 * @param key      Unique bucket key (e.g. "api:1.2.3.4", "email:user@test.com")
 * @param limit    Max tokens in the bucket (request count)
 * @param windowMs Window in ms that defines the refill rate (limit / windowMs = tokens/sec)
 * @param cost     Tokens to consume (default 1)
 * @param failOpen If true, allows the request when DB is unreachable (default: true)
 */
export async function consumeDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1,
  failOpen = true,
): Promise<RateLimitResult> {
  try {
    const refillPerSec = limit / (windowMs / 1000)
    const admin = createSupabaseAdminClient()
    const result = await admin.rpc('consume_rate_limit', {
      p_bucket_key: key,
      p_capacity: limit,
      p_refill_per_sec: refillPerSec,
      p_cost: cost,
    }).single()

    if (result.error) throw result.error
    const row = result.data as unknown as RpcRateLimitRow
    if (!row) throw new Error('No data returned from consume_rate_limit')

    return {
      allowed: Boolean(row.allowed),
      remaining: Math.max(0, Math.floor(Number(row.remaining ?? 0))),
      resetAt: new Date(String(row.reset_at)).getTime(),
    }
  } catch (err) {
    console.error(
      `[rate-limit] DB error for key=${key}, failing ${failOpen ? 'open' : 'closed'}`,
      err instanceof Error ? err.message : err,
    )

    if (failOpen) {
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs }
    }
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs }
  }
}

// ─── Preset key + limit helpers ──────────────────────────────

/** Global API rate limit: 100 requests per IP per 15 minutes. */
export function apiRateKey(ip: string): { key: string; limit: number; windowMs: number } {
  return { key: `api:${ip}`, limit: 100, windowMs: 15 * 60 * 1000 }
}

/** Auth rate limit: 5 attempts per email per 15 minutes. */
export function authEmailKey(email: string): { key: string; limit: number; windowMs: number } {
  return { key: `auth-email:${email.trim().toLowerCase()}`, limit: 5, windowMs: 15 * 60 * 1000 }
}

/** Auth rate limit: 5 attempts per IP per 15 minutes. */
export function authIpKey(ip: string): { key: string; limit: number; windowMs: number } {
  return { key: `auth-ip:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 }
}

/** Widget config: 30 requests per IP per minute. */
export function widgetConfigKey(ip: string): { key: string; limit: number; windowMs: number } {
  return { key: `widget-config:${ip}`, limit: 30, windowMs: 60_000 }
}

/** Widget chat: 20 messages per visitor+IP per minute. */
export function widgetChatKey(visitorId: string, ip: string): { key: string; limit: number; windowMs: number } {
  return { key: `widget-chat:${visitorId}:${ip}`, limit: 20, windowMs: 60_000 }
}

/** Widget events: 60 per visitor per minute. */
export function widgetEventsKey(visitorId: string): { key: string; limit: number; windowMs: number } {
  return { key: `widget-events:${visitorId}`, limit: 60, windowMs: 60_000 }
}

/** Widget appointments: 5 per visitor+IP per minute. */
export function widgetAppointmentKey(visitorId: string, ip: string): { key: string; limit: number; windowMs: number } {
  return { key: `widget-appt:${visitorId}:${ip}`, limit: 5, windowMs: 60_000 }
}
