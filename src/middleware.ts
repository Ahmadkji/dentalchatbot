import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkApiRateLimit, getClientIp } from '@/lib/security'

const devScriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
const prodScriptSrc = "script-src 'self' 'unsafe-inline'"

const cspBase = "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; STYLE_PLACEHOLDER; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co"

function getCspHeader(): string {
  const scriptSrc = process.env.NODE_ENV === 'development' ? devScriptSrc : prodScriptSrc
  return cspBase.replace('STYLE_PLACEHOLDER', scriptSrc)
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': getCspHeader(),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
}

function applySecurityHeaders(response: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    response.headers.set(header, value)
  })
  return response
}

export async function middleware(request: NextRequest) {
  // HTTPS enforcement (Item 30)
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') === 'http'
  ) {
    const httpsUrl = new URL(request.url)
    httpsUrl.protocol = 'https'
    return NextResponse.redirect(httpsUrl, 301)
  }

  // Global API rate limiting (Item 19)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = getClientIp(request.headers)
    const rateLimit = checkApiRateLimit(ip)

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.', resetAt: rateLimit.resetAt },
        { status: 429 }
      )
      response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
      return applySecurityHeaders(response)
    }
  }

  const supabaseResponse = await updateSession(request)

  // Apply security headers to all responses (Item 27)
  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     *
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
