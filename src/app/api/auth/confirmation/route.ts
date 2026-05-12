import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/security'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { mapConfirmationEmailError } from '@/lib/supabase/auth-errors'
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

  const email = typeof (payload as { email?: string }).email === 'string'
    ? (payload as { email?: string }).email.trim().toLowerCase()
    : ''

  if (!email) {
    return buildResponse({ error: 'Email address is required.' }, 400)
  }

  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    return buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${url.origin}/auth/callback`,
    },
  })

  if (error) {
    const mapped = mapConfirmationEmailError(error)
    return buildResponse({ error: mapped.message }, mapped.status)
  }

  const response = buildResponse({ ok: true }, 200)
  return copyResponseCookies(cookieResponse, response)
}
