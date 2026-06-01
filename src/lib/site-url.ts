const LOCAL_SITE_URL = 'http://localhost:3000'

function normalizeSiteUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function stripLeadingWww(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '')
}

export function getSiteUrl() {
  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeSiteUrl(process.env.VERCEL_URL) ||
    LOCAL_SITE_URL
  )
}

export function getCanonicalRedirectUrl(input: string | URL) {
  const requestUrl = input instanceof URL ? new URL(input.toString()) : new URL(input)
  const canonicalUrl = new URL(getSiteUrl())
  const requestHost = requestUrl.hostname.toLowerCase()
  const canonicalHost = canonicalUrl.hostname.toLowerCase()

  // Only normalize www/non-www pairs for the same base domain.
  if (!canonicalHost.includes('.')) {
    return null
  }

  if (stripLeadingWww(requestHost) !== stripLeadingWww(canonicalHost)) {
    return null
  }

  if (requestHost === canonicalHost) {
    return null
  }

  const redirectUrl = new URL(requestUrl.toString())
  redirectUrl.protocol = canonicalUrl.protocol
  redirectUrl.hostname = canonicalUrl.hostname
  redirectUrl.port = canonicalUrl.port

  return redirectUrl.toString()
}
