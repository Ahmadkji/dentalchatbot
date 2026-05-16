import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Widget Access Token — a short-lived, signed JWT-like token that proves
 * the public bootstrap route verified the parent website origin.
 *
 * Structure: `<payload>.<signature>`
 * Payload: base64url(JSON({ slug, origin, iat, jti }))
 * Signature: HMAC-SHA256(payload, WIDGET_ACCESS_TOKEN_SECRET)
 *
 * Lifetime: 5 minutes (configurable via WIDGET_ACCESS_TOKEN_TTL_MS)
 *
 * Security model:
 * - The `origin` field records which parent domain was verified at bootstrap.
 * - At consumption time (chat/events/appointments), the iframe is same-origin
 *   so the HTTP Origin header is the app domain, not the parent domain.
 * - This means the token effectively behaves as a short-lived bearer token.
 * - The threat model accepts this: the token is never in URLs (postMessage only),
 *   the 5-min TTL limits exposure, and the token is useless without the slug.
 * - If stronger binding is needed later, add a JTI denylist or switch to
 *   per-request tokens (e.g., via a server-side session store).
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getSecret(): string {
  const secret = process.env.WIDGET_ACCESS_TOKEN_SECRET?.trim()
  if (!secret) {
    throw new Error('WIDGET_ACCESS_TOKEN_SECRET env var is required for widget access tokens.')
  }
  return secret
}

function getTtlMs(): number {
  const env = process.env.WIDGET_ACCESS_TOKEN_TTL_MS?.trim()
  if (env) {
    const parsed = Number(env)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_TTL_MS
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  return Buffer.from(base64, 'base64').toString('utf-8')
}

interface WidgetAccessPayload {
  /** Clinic slug — identifies which clinic this token is for. */
  slug: string
  /** The verified parent website origin (e.g. https://example.com). */
  origin: string
  /** Issued-at timestamp (epoch ms). */
  iat: number
  /** Unique token ID to prevent replay (random hex). */
  jti: string
}

export interface VerifiedWidgetAccess extends WidgetAccessPayload {
  /** Remaining TTL in ms. */
  ttlMs: number
}

/**
 * Mint a new widget access token for a verified clinic/origin pair.
 * Called only by the public bootstrap route after domain verification.
 */
export function mintWidgetAccessToken(slug: string, origin: string): string {
  const payload: WidgetAccessPayload = {
    slug,
    origin,
    iat: Date.now(),
    jti: randomBytes(16).toString('hex'),
  }

  const payloadJson = JSON.stringify(payload)
  const payloadEncoded = base64UrlEncode(payloadJson)

  const signature = createHmac('sha256', getSecret())
    .update(payloadEncoded)
    .digest('hex')

  return `${payloadEncoded}.${signature}`
}

/**
 * Verify a widget access token.
 * Returns the decoded payload if valid and not expired, null otherwise.
 *
 * Checks:
 * - Signature matches
 * - Token has not expired
 */
export function verifyWidgetAccessToken(token: string): VerifiedWidgetAccess | null {
  if (!token || typeof token !== 'string') return null

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return null

  const payloadEncoded = token.slice(0, dotIndex)
  const providedSignature = token.slice(dotIndex + 1)

  // Verify signature
  const expectedSignature = createHmac('sha256', getSecret())
    .update(payloadEncoded)
    .digest('hex')

  // Timing-safe comparison to prevent timing attacks
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
  ) {
    return null
  }

  // Decode payload
  let payload: WidgetAccessPayload
  try {
    const payloadJson = base64UrlDecode(payloadEncoded)
    payload = JSON.parse(payloadJson)
  } catch {
    return null
  }

  // Validate required fields
  if (!payload.slug || !payload.origin || !payload.iat || !payload.jti) return null

  // Check expiry
  const ttlMs = getTtlMs()
  const age = Date.now() - payload.iat
  if (age > ttlMs) return null

  return {
    ...payload,
    ttlMs: ttlMs - age,
  }
}
