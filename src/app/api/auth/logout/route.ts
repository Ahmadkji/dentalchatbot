import { NextResponse } from 'next/server'
import { assertSameOrigin, clearUserSessions } from '@/lib/security'
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
    console.error('[auth:logout] CSRF origin check failed', {
      origin: request.headers.get('origin'),
      host: url.host,
      error: originError instanceof Error ? originError.message : String(originError),
    })
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const cookieResponse = new NextResponse()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    console.error('[auth:logout] Auth configuration missing')
    return buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  // Capture user ID before signOut revokes the session.
  // signOut() invalidates the refresh token server-side, after which getUser() would fail.
  const { data: { user } } = await supabase.auth.getUser()

  // signOut() revokes the refresh token server-side and invalidates auth cookies
  // via the SSR setAll callback. Default scope 'global' signs out all devices.
  const { error: signOutError } = await supabase.auth.signOut()

  if (signOutError) {
    console.error('[auth:logout] Supabase signOut failed', {
      userId: user?.id ?? null,
      error: signOutError.message,
      code: signOutError.status ?? null,
    })
    // Continue — cookies are still propagated and session tracking is cleared below.
    // A failed signOut (e.g., token already expired) is not fatal.
  }

  // Clear shared session tracking (device registry in Postgres)
  if (user) {
    await clearUserSessions(user.id)
  } else {
    console.warn('[auth:logout] No authenticated user found — session tracking may be stale')
  }

  const response = buildResponse({ ok: true }, 200)
  return copyResponseCookies(cookieResponse, response)
}
