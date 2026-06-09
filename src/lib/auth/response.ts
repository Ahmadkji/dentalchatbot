import { NextResponse } from 'next/server'
import { buildSecurityHeaders } from '@/lib/security-headers'

/**
 * Headers applied to private (no-store) API responses.
 *
 * These reuse the single security-header source of truth in
 * `@/lib/security-headers` (nonce-based CSP) so there are never two competing
 * CSP definitions. Previously this file declared its own weaker
 * `'unsafe-inline'` script-src that diverged from the proxy policy.
 */
const PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  ...buildSecurityHeaders(),
}

export function setPrivateNoStore(response: NextResponse) {
  Object.entries(PRIVATE_HEADERS).forEach(([header, value]) => {
    response.headers.set(header, value)
  })
  return response
}

export function copyResponseCookies(source: NextResponse, target: NextResponse) {
  // Copy cookies with full attributes (httpOnly, sameSite, secure, path, etc.)
  // using the overload that accepts a complete ResponseCookie object.
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })

  // Propagate headers from source (e.g. @supabase/ssr cache headers via setAll).
  // Don't overwrite headers the target has already set.
  source.headers.forEach((value, key) => {
    if (!target.headers.has(key)) {
      target.headers.set(key, value)
    }
  })

  return target
}
