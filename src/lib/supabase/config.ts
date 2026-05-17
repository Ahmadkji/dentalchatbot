import { publicEnv } from '@/lib/env/public'

export interface SupabaseAuthConfig {
  url: string
  publishableKey: string
}

export function getSupabaseAuthConfig(): SupabaseAuthConfig {
  return {
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}
