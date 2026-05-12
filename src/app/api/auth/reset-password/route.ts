import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/security'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'

/**
 * Password Reset Flow (Items 21-22):
 *
 * Supabase handles the full password reset token lifecycle:
 * - Tokens are single-use by default (Supabase invalidates after use)
 * - Token expiry defaults to 1 hour (configurable in Supabase dashboard)
 * - The forgot-password endpoint sends a generic response to prevent email enumeration
 * - This route handles the actual password update after the user clicks the reset link
 *   and is authenticated via the recovery session
 * - updateUser() invalidates the recovery session automatically
 */

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

async function requireSession(request: Request) {
  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    return { cookieResponse, supabase: null, error: buildResponse({ error: 'Auth configuration missing.' }, 500) }
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { cookieResponse, supabase, error: buildResponse({ error: 'Session expired.' }, 401) }
  }

  return { cookieResponse, supabase, error: null }
}

export async function HEAD(request: Request) {
  const { cookieResponse, supabase, error } = await requireSession(request)
  if (error) {
    return error
  }

  const response = buildResponse({ ok: true }, 200)
  return copyResponseCookies(cookieResponse, response)
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
    return buildResponse({ error: 'Password is required.' }, 400)
  }

  const password = typeof (payload as { password?: string }).password === 'string'
    ? (payload as { password?: string }).password
    : ''

  if (!password) {
    return buildResponse({ error: 'Password is required.' }, 400)
  }

  if (password.length < 8) {
    return buildResponse({ error: 'Password must be at least 8 characters.' }, 400)
  }

  const { cookieResponse, supabase, error } = await requireSession(request)
  if (error || !supabase) {
    return error ?? buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return buildResponse({ error: 'Unable to update password.' }, 400)
  }

  const response = buildResponse({ ok: true }, 200)
  return copyResponseCookies(cookieResponse, response)
}
