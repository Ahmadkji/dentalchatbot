import { NextResponse } from 'next/server'

const devScriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
const prodScriptSrc = (nonce: string) => `script-src 'self' 'nonce-${nonce}'`

const cspBase = "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; STYLE_PLACEHOLDER; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co"

export function getCspHeader(nonce?: string): string {
  const scriptSrc =
    process.env.NODE_ENV === 'development'
      ? devScriptSrc
      : prodScriptSrc(nonce ?? '')
  return cspBase.replace('STYLE_PLACEHOLDER', scriptSrc)
}

export function buildSecurityHeaders(nonce?: string): Record<string, string> {
  return {
    'Content-Security-Policy': getCspHeader(nonce),
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'on',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  }
}

export function applySecurityHeaders(
  response: NextResponse,
  isWidgetFrame = false,
  nonce?: string
) {
  const securityHeaders = buildSecurityHeaders(nonce)

  Object.entries(securityHeaders).forEach(([header, value]) => {
    if (isWidgetFrame && header === 'X-Frame-Options') return
    if (isWidgetFrame && header === 'Content-Security-Policy') {
      const widgetCsp = value.replace("frame-ancestors 'none'", 'frame-ancestors *')
      response.headers.set(header, widgetCsp)
      return
    }
    response.headers.set(header, value)
  })

  return response
}
