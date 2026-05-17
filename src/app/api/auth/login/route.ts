import { NextResponse } from 'next/server'
import { assertSameOrigin, getClientIp, registerSession } from '@/lib/security'
import { consumeDistributedRateLimit, authEmailKey, authIpKey } from '@/lib/rate-limit'
import { sanitizeNextPath } from '@/lib/auth/navigation'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { setPrivateNoStore, copyResponseCookies } from '@/lib/auth/response'
import { mapSignupError } from '@/lib/supabase/auth-errors'

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

export async function POST(request: Request) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch {
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    return buildResponse({ error: 'Request body is required.' }, 400)
  }

  const body = payload as { mode?: string; email?: string; password?: string; next?: string }
  const mode = body.mode === 'signup' ? 'signup' : 'signin'
  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : ''
  const password = typeof body.password === 'string'
    ? body.password
    : ''
  const next = sanitizeNextPath(body.next)

  if (!email) {
    return buildResponse({ error: 'Email address is required.' }, 400)
  }

  if (!password) {
    return buildResponse({ error: 'Password is required.' }, 400)
  }

  // Distributed rate limit: check both email and IP buckets (fail-closed)
  const ip = getClientIp(request.headers)
  const emailPreset = authEmailKey(email)
  const ipPreset = authIpKey(ip)
  const [emailResult, ipResult] = await Promise.all([
    consumeDistributedRateLimit(emailPreset.key, emailPreset.limit, emailPreset.windowMs, 1, false),
    consumeDistributedRateLimit(ipPreset.key, ipPreset.limit, ipPreset.windowMs, 1, false),
  ])
  const rateLimit = {
    allowed: emailResult.allowed && ipResult.allowed,
    remaining: Math.min(emailResult.remaining, ipResult.remaining),
    resetAt: Math.min(emailResult.resetAt, ipResult.resetAt),
  }

  if (!rateLimit.allowed) {
    const response = buildResponse(
      {
        error: 'Too many attempts. Please try again later.',
        resetAt: rateLimit.resetAt,
      },
      429
    )
    response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
    return response
  }

  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)
  if (!supabase) {
    return buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    if (error) {
      const mapped = mapSignupError(error)
      return buildResponse({ error: mapped.message }, mapped.status)
    }

    if (!data.session) {
      const response = buildResponse(
        {
          confirmationRequired: true,
          email,
          next: `/verify-email?email=${encodeURIComponent(email)}`,
        },
        200
      )
      return copyResponseCookies(cookieResponse, response)
    }

    const response = buildResponse({ ok: true, next }, 200)
    return copyResponseCookies(cookieResponse, response)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session) {
    return buildResponse({ error: 'Invalid credentials' }, 401)
  }

  // Register session for device tracking (Items 24, 26)
  registerSession(
    data.session.user.id,
    data.session.access_token.substring(0, 16),
    getClientIp(request.headers),
    request.headers.get('user-agent') || 'unknown'
  )

  const response = buildResponse({ ok: true, next }, 200)
  return copyResponseCookies(cookieResponse, response)
}
