import { NextResponse } from 'next/server'

const devScriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
const prodScriptSrc = "script-src 'self' 'unsafe-inline'"

const cspBase = "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; SCRIPT_PLACEHOLDER; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co"

function getCspHeader(): string {
  const scriptSrc = process.env.NODE_ENV === 'development' ? devScriptSrc : prodScriptSrc
  return cspBase.replace('SCRIPT_PLACEHOLDER', scriptSrc)
}

const PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': getCspHeader(),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
}

export function setPrivateNoStore(response: NextResponse) {
  Object.entries(PRIVATE_HEADERS).forEach(([header, value]) => {
    response.headers.set(header, value)
  })
  return response
}

export function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value }) => {
    target.cookies.set(name, value)
  })

  return target
}
