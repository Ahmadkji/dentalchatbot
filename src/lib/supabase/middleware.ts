import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'
import { applySecurityHeaders } from '@/lib/security-headers'
import { publicEnv } from '@/lib/env/public'

function applyCookieDefaults(
  options: Parameters<NextResponse['cookies']['set']>[2] | undefined
) {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: options?.secure ?? process.env.NODE_ENV === 'production',
  }
}

function withNonceHeaders(request: NextRequest, nonce?: string) {
  const headers = new Headers(request.headers)
  if (nonce) {
    headers.set('x-nonce', nonce)
  }
  return headers
}

export async function updateSession(request: NextRequest, nonce?: string) {
  const requestHeaders = withNonceHeaders(request, nonce)
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers = {}) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, applyCookieDefaults(options))
          )

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value)
          })
        },
      },
    }
  )

  // Use getClaims() instead of getUser() for faster JWT validation.
  // getUser() contacts the Auth server on every call (~50-200ms latency).
  // getClaims() validates the JWT locally using cached JWKS (asymmetric keys)
  // or falls back to Auth server (symmetric keys) — same security, faster.
  // API routes still use getUser() via requireAuth() for fresh user records.

  let userId: string | null = null
  try {
    const { data, error: claimsError } = await supabase.auth.getClaims()
    if (claimsError) {
      console.warn('[middleware:getClaims] JWT validation failed', {
        pathname: request.nextUrl.pathname,
        errorMessage: claimsError.message,
        errorCode: claimsError.status ?? null,
      })
      // Continue without user — protected routes will redirect to login
    } else if (data?.claims?.sub) {
      userId = data.claims.sub
    } else {
      console.warn('[middleware:getClaims] No sub claim in JWT', {
        pathname: request.nextUrl.pathname,
        hasClaims: Boolean(data?.claims),
      })
    }
  } catch (error) {
    console.error('[middleware:getClaims] Unexpected error during JWT validation', {
      pathname: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    })
    // Continue without user — protected routes will redirect to login
  }

  const pathname = request.nextUrl.pathname
  const isWidgetFrame = pathname.startsWith('/widget-frame')
  const authPaths = [
    '/',
    '/login',
    '/signup',
    '/auth',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/auth/callback',
    '/auth/confirm',
  ]

  const protectedPaths = ['/dashboard', '/settings', '/onboarding']
  const isProtectedPath = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
  const isAuthPath = authPaths.includes(pathname) || pathname.startsWith('/auth/')
  let onboardingComplete = false

  const needsOnboardingCheck =
    Boolean(userId) &&
    (isProtectedPath || pathname === '/' || pathname === '/onboarding' || isAuthPath)

  if (needsOnboardingCheck && userId) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed,default_clinic_id')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('[middleware:profile] Failed to fetch user profile', {
          pathname: request.nextUrl.pathname,
          error: profileError.message,
        })
        // Don't lock out user — treat as onboarding complete so they can access dashboard
        onboardingComplete = true
      } else {
        onboardingComplete = Boolean(profile?.onboarding_completed && profile.default_clinic_id)
      }
    } catch (error) {
      console.error('[middleware:profile] Profile query threw unexpectedly', {
        pathname: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      })
      // Graceful: treat as onboarding complete to avoid locking out users
      onboardingComplete = true
    }
  }

  if (!userId && isProtectedPath) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    return copyResponseCookies(
      supabaseResponse,
      applySecurityHeaders(setPrivateNoStore(response), isWidgetFrame, nonce)
    )
  }

  if (userId && isProtectedPath && pathname !== '/onboarding' && !onboardingComplete) {
    const response = NextResponse.redirect(new URL('/onboarding', request.url))
    return copyResponseCookies(
      supabaseResponse,
      applySecurityHeaders(setPrivateNoStore(response), isWidgetFrame, nonce)
    )
  }

  if (userId && pathname === '/onboarding' && onboardingComplete) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    return copyResponseCookies(
      supabaseResponse,
      applySecurityHeaders(setPrivateNoStore(response), isWidgetFrame, nonce)
    )
  }

  if (userId && (pathname === '/' || isAuthPath)) {
    const response = NextResponse.redirect(new URL(onboardingComplete ? '/dashboard' : '/onboarding', request.url))
    return copyResponseCookies(
      supabaseResponse,
      applySecurityHeaders(setPrivateNoStore(response), isWidgetFrame, nonce)
    )
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may cause the browser and server to go out of sync
  // and terminate the user's session prematurely!
  if (isProtectedPath || isAuthPath) {
    return applySecurityHeaders(setPrivateNoStore(supabaseResponse), isWidgetFrame, nonce)
  }

  return supabaseResponse
}
