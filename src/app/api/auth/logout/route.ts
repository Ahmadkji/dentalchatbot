import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/security'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'
import { requireAuth } from '@/lib/auth-helpers'
import { unregisterSession } from '@/lib/security'

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

  // Get current user for session cleanup
  const { user } = await requireAuth()

  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    return buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    return buildResponse({ error: 'Unable to sign out.' }, 500)
  }

  // Unregister session from tracking (Items 24, 26)
  if (user) {
    unregisterSession(user.id, 'local')
  }

  const response = buildResponse({ ok: true }, 200)
  return copyResponseCookies(cookieResponse, response)
}
