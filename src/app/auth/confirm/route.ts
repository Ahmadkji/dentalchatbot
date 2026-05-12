import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { sanitizeNextPath } from '@/lib/auth/navigation'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as 'signup' | 'recovery' | 'email_change' | null
  const next = sanitizeNextPath(url.searchParams.get('next'))

  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    const response = NextResponse.redirect(new URL('/login?error=auth-config-missing', url.origin))
    return setPrivateNoStore(response)
  }

  if (!tokenHash || !type) {
    const response = NextResponse.redirect(new URL('/login?error=verification_failed', url.origin))
    return setPrivateNoStore(response)
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    const response = NextResponse.redirect(new URL('/login?error=verification_failed', url.origin))
    return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
  }

  const response = NextResponse.redirect(new URL(next, url.origin))
  return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
}
