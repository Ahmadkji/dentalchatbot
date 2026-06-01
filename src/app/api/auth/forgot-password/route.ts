import { NextResponse } from 'next/server'
import { assertSameOrigin, getClientIp } from '@/lib/security'
import { consumeDistributedRateLimit, authEmailKey, authIpKey, forgotPasswordCooldownKey } from '@/lib/rate-limit'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

export async function POST(request: Request) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch (originError) {
    console.error('[auth:forgot-password] CSRF origin check failed', {
      origin: request.headers.get('origin'),
      host: url.host,
      error: originError instanceof Error ? originError.message : String(originError),
    })
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
        error: 'Too many requests. Please try again later.',
        resetAt: rateLimit.resetAt,
      },
      429
    )
    response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
    return response
  }

  // Email cooldown: prevent duplicate emails from concurrent/double-click requests
  const cooldownPreset = forgotPasswordCooldownKey(email)
  const cooldownResult = await consumeDistributedRateLimit(
    cooldownPreset.key, cooldownPreset.limit, cooldownPreset.windowMs, 1, true
  )
  if (!cooldownResult.allowed) {
    console.warn('[auth:forgot-password] Email cooldown active', { email, resetAt: cooldownResult.resetAt })
    const response = buildResponse(
      { error: 'Please wait a moment before requesting another reset link.', resetAt: cooldownResult.resetAt },
      429
    )
    response.headers.set('Retry-After', String(Math.ceil((cooldownResult.resetAt - Date.now()) / 1000)))
    return response
  }

  const cookieResponse = new NextResponse()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (supabase) {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}/reset-password`,
    })
    if (resetError) {
      console.error('[auth:forgot-password] Password reset attempt failed', {
        error: resetError.message,
        code: resetError.status ?? null,
      })
      // Still return success to prevent email enumeration
    }
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
