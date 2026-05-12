export const AUTH_NEXT_PATH_COOKIE = 'auth-next-path'

const DEFAULT_NEXT_PATH = '/dashboard'

export function sanitizeNextPath(nextPath: string | null | undefined): string {
  if (typeof nextPath !== 'string') {
    return DEFAULT_NEXT_PATH
  }

  const trimmed = nextPath.trim()
  if (!trimmed) {
    return DEFAULT_NEXT_PATH
  }

  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('://') ||
    trimmed.includes('\\')
  ) {
    return DEFAULT_NEXT_PATH
  }

  return trimmed
}
