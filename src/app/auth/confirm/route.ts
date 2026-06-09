import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { sanitizeNextPath } from '@/lib/auth/navigation'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as 'signup' | 'recovery' | 'email_change' | null
  const next = sanitizeNextPath(url.searchParams.get('next'))

  const cookieResponse = new NextResponse()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    console.error('[auth:confirm] Auth configuration missing')
    const response = NextResponse.redirect(new URL('/login?error=auth-config-missing', url.origin))
    return setPrivateNoStore(response)
  }

  if (!tokenHash || !type) {
    console.warn('[auth:confirm] Missing token_hash or type parameter', {
      hasTokenHash: Boolean(tokenHash),
      hasType: Boolean(type),
    })
    const response = NextResponse.redirect(new URL('/login?error=verification_failed', url.origin))
    return setPrivateNoStore(response)
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    console.error('[auth:confirm] OTP verification failed', {
      type,
      error: error.message,
      code: error.status ?? null,
    })
    const response = NextResponse.redirect(new URL('/login?error=verification_failed', url.origin))
    return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
  }

  const response = NextResponse.redirect(new URL(next, url.origin))
  return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
}
