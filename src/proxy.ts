import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { applySecurityHeaders } from '@/lib/security-headers'
import { getCanonicalRedirectUrl } from '@/lib/site-url'

function generateNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const redirectUrl = new URL(request.url)
    let shouldRedirect = false

    if (request.headers.get('x-forwarded-proto') === 'http') {
      redirectUrl.protocol = 'https'
      shouldRedirect = true
    }

    const canonicalRedirectUrl = getCanonicalRedirectUrl(redirectUrl)
    if (canonicalRedirectUrl) {
      shouldRedirect = true
    }

    if (shouldRedirect) {
      return NextResponse.redirect(canonicalRedirectUrl ?? redirectUrl, 301)
    }
  }

  const nonce = generateNonce()
  const isWidgetFrame = request.nextUrl.pathname.startsWith('/widget-frame')

  let supabaseResponse: NextResponse
  try {
    supabaseResponse = await updateSession(request, nonce)
  } catch (error) {
    console.error('[middleware] updateSession failed — serving request without session refresh', {
      pathname: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    })
    // Graceful degradation: continue without session refresh
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Apply security headers to all responses (Item 27)
  // /widget-frame gets permissive frame headers to allow embedding
  return applySecurityHeaders(supabaseResponse, isWidgetFrame, nonce)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml, llms.txt (metadata-like files)
     * - public files (svg, png, jpg, etc.)
     *
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
