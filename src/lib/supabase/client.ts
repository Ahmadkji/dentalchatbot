import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env/public'

/**
 * Browser-side Supabase client.
 * Only used for OAuth flows (e.g. Google sign-in) that require client-side redirects.
 * All other auth operations go through /api/auth/* routes.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
