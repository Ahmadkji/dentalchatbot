import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { sanitizeNextPath } from '@/lib/auth/navigation'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'
import { getCurrentClinic } from '@/lib/clinics/current'
import { extractSessionId, getClientIp, registerSession } from '@/lib/security'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const code = searchParams.get('code')
  const next = sanitizeNextPath(searchParams.get('next'))

  // ---- OAuth provider error handling (RFC 6749 §4.1.2.1) ----
  // When the user denies consent or the provider errors, Google/others
  // redirect back with ?error=access_denied&error_description=… instead of
  // a code. We must surface this to the user instead of silently redirecting
  // to /login with no explanation.
  const oauthError = searchParams.get('error')
  const oauthErrorDescription = searchParams.get('error_description')

  if (oauthError) {
    console.error('[auth:callback] OAuth provider returned an error', {
      error: oauthError,
      description: oauthErrorDescription,
    })

    // Map known OAuth error codes to user-facing messages on the login page.
    const errorCode =
      oauthError === 'access_denied' ? 'oauth-denied' : 'oauth-error'
    const loginUrl = new URL(`/login?error=${errorCode}`, url.origin)
    const response = NextResponse.redirect(loginUrl)
    return setPrivateNoStore(response)
  }

  const cookieResponse = new NextResponse()
  const supabase = await createSupabaseRouteClient(cookieResponse)
  if (!supabase) {
    console.error('[auth:callback] Auth configuration missing')
    const response = NextResponse.redirect(new URL('/login?error=auth-config-missing', url.origin))
    return setPrivateNoStore(response)
  }

  if (!code) {
    console.warn('[auth:callback] Missing code parameter in OAuth callback (no error param either)')
    const response = NextResponse.redirect(new URL('/login?error=auth-callback', url.origin))
    return setPrivateNoStore(response)
  }

  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth:callback] Failed to exchange code for session', {
      error: error.message,
      code: error.status ?? null,
    })
    const response = NextResponse.redirect(new URL('/login?error=auth-callback', url.origin))
    return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
  }

  const user = exchangeData.user ?? exchangeData.session?.user ?? null

  if (!user) {
    console.error('[auth:callback] No user returned after session exchange')
    const response = NextResponse.redirect(new URL('/login?error=auth-callback', url.origin))
    return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
  }

  // Register the OAuth/email-confirmation session for device tracking.
  // This was previously missing — only the email/password login path called
  // registerSession(), so Google OAuth users were invisible to the session
  // registry (session limiting and force-logout didn't work for them).
  if (exchangeData.session?.access_token) {
    const sessionKey = extractSessionId(exchangeData.session.access_token)
    try {
      await registerSession(
        user.id,
        sessionKey ?? crypto.randomUUID(),
        getClientIp(request.headers),
        request.headers.get('user-agent') || 'unknown'
      )
    } catch (sessionError) {
      console.error('[auth:callback] session registration failed (non-fatal)', {
        userId: user.id,
        error: sessionError instanceof Error ? sessionError.message : String(sessionError),
      })
    }
  }

  try {
    const { profile, clinic } = await getCurrentClinic(supabase, user)

    if (!profile?.onboarding_completed || !profile.default_clinic_id || !clinic) {
      const response = NextResponse.redirect(new URL('/onboarding', url.origin))
      return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
    }
  } catch (clinicError) {
    console.error('[auth:callback] Failed to fetch clinic profile — redirecting to onboarding', {
      userId: user.id,
      error: clinicError instanceof Error ? clinicError.message : String(clinicError),
    })
    const response = NextResponse.redirect(new URL('/onboarding', url.origin))
    return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
  }

  const response = NextResponse.redirect(new URL(next === '/onboarding' ? '/dashboard' : next, url.origin))
  return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
}
