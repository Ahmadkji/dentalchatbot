import { NextResponse } from 'next/server'
import { assertSameOrigin, checkAuthRateLimit, getClientIp, registerSession } from '@/lib/security'
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

  const mode = (payload as { mode?: string }).mode === 'signup' ? 'signup' : 'signin'
  const email = typeof (payload as { email?: string }).email === 'string'
    ? (payload as { email?: string }).email.trim().toLowerCase()
    : ''
  const password = typeof (payload as { password?: string }).password === 'string'
    ? (payload as { password?: string }).password
    : ''
  const next = sanitizeNextPath((payload as { next?: string }).next)

  if (!email) {
    return buildResponse({ error: 'Email address is required.' }, 400)
  }

  if (!password) {
    return buildResponse({ error: 'Password is required.' }, 400)
  }

  const rateLimit = checkAuthRateLimit({
    email,
    ip: getClientIp(request.headers),
  })

  if (!rateLimit.allowed) {
    return buildResponse(
      {
        error: 'Too many attempts. Please try again later.',
        resetAt: rateLimit.resetAt,
      },
      429
    )
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
