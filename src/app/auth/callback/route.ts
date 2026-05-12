import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { sanitizeNextPath } from '@/lib/auth/navigation'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const code = searchParams.get('code')
  const next = sanitizeNextPath(searchParams.get('next'))

  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)
  if (!supabase) {
    const response = NextResponse.redirect(new URL('/login?error=auth-config-missing', url.origin))
    return setPrivateNoStore(response)
  }

  if (!code) {
    const response = NextResponse.redirect(new URL('/login', url.origin))
    return setPrivateNoStore(response)
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const response = NextResponse.redirect(new URL('/login?error=auth-callback', url.origin))
    return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
  }

  const response = NextResponse.redirect(new URL(next, url.origin))
  return copyResponseCookies(cookieResponse, setPrivateNoStore(response))
}
