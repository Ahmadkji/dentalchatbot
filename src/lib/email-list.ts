export function normalizeEmail(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return undefined
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed) ? trimmed : undefined
}

export function parseEmailList(value: string | null | undefined): string[] {
  if (typeof value !== 'string') return []

  const seen = new Set<string>()
  const emails: string[] = []

  for (const part of value.split(/[\n,;]/g)) {
    const email = normalizeEmail(part)
    if (!email || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }

  return emails
}
