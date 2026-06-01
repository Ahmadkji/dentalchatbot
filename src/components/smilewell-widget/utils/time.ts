export function getDisplayTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function getCurrentTime() {
  const now = new Date()
  let hours = now.getHours()
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

export function getSourcePage() {
  if (typeof window === 'undefined') return null

  try {
    const querySourcePage = new URLSearchParams(window.location.search).get('sourcePage')?.trim()
    if (querySourcePage) return querySourcePage.slice(0, 500)
  } catch {
    // Ignore malformed query strings and fall back to referrer below.
  }

  if (typeof document === 'undefined') return null

  const referrer = document.referrer.trim()
  if (!referrer) return null

  try {
    const url = new URL(referrer)
    return `${url.origin}${url.pathname}`
  } catch {
    return referrer.slice(0, 500)
  }
}
