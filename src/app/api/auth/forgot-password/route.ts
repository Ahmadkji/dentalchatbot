import { NextResponse } from 'next/server'
import { assertSameOrigin, checkAuthRateLimit, getClientIp } from '@/lib/security'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'

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
    return buildResponse({ error: 'Email address is required.' }, 400)
  }

  const body = payload as { email?: string }
  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : ''

  if (!email) {
    return buildResponse({ error: 'Email address is required.' }, 400)
  }

  const rateLimit = checkAuthRateLimit({
    email,
    ip: getClientIp(request.headers),
  })

  if (!rateLimit.allowed) {
    return buildResponse(
      {
        error: 'Too many requests. Please try again later.',
        resetAt: rateLimit.resetAt,
      },
      429
    )
  }

  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (supabase) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}/reset-password`,
    })
  }

  const response = buildResponse(
    {
      ok: true,
      message: 'If an account exists, you will receive a reset link shortly.',
    },
    200
  )

  return supabase ? copyResponseCookies(cookieResponse, response) : response
}
