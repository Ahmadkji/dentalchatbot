const WIDGET_TOKEN_STALE_MS = 4 * 60 * 1000

export function isAccessTokenStale(token: string | null): boolean {
  if (!token) return true
  try {
    const dotIndex = token.indexOf('.')
    if (dotIndex === -1) return true
    const payloadB64 = token.slice(0, dotIndex)

    let b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const payloadJson = atob(b64)
    const payload = JSON.parse(payloadJson)
    if (!payload.iat || typeof payload.iat !== 'number') return true
    return Date.now() - payload.iat > WIDGET_TOKEN_STALE_MS
  } catch {
    return true
  }
}
