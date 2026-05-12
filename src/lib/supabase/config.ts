export interface SupabaseAuthConfig {
  url: string
  publishableKey: string
}

function trimEnv(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const publishableKey = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

  if (!url || !publishableKey) {
    return null
  }

  try {
    new URL(url)
  } catch {
    return null
  }

  return {
    url,
    publishableKey,
  }
}
