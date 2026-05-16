import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'

function applyStrictCookieDefaults(
  options: Parameters<NextResponse['cookies']['set']>[2] | undefined
) {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: options?.secure ?? process.env.NODE_ENV === 'production',
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, applyStrictCookieDefaults(options))
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
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

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed,default_clinic_id')
      .eq('id', user.id)
      .maybeSingle()

    onboardingComplete = Boolean(profile?.onboarding_completed && profile.default_clinic_id)
  }

  if (!user && isProtectedPath) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    return copyResponseCookies(supabaseResponse, setPrivateNoStore(response))
  }

  if (user && isProtectedPath && pathname !== '/onboarding' && !onboardingComplete) {
    const response = NextResponse.redirect(new URL('/onboarding', request.url))
    return copyResponseCookies(supabaseResponse, setPrivateNoStore(response))
  }

  if (user && pathname === '/onboarding' && onboardingComplete) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    return copyResponseCookies(supabaseResponse, setPrivateNoStore(response))
  }

  if (user && (pathname === '/' || isAuthPath)) {
    const response = NextResponse.redirect(new URL(onboardingComplete ? '/dashboard' : '/onboarding', request.url))
    return copyResponseCookies(supabaseResponse, setPrivateNoStore(response))
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
    return setPrivateNoStore(supabaseResponse)
  }

  return supabaseResponse
}
