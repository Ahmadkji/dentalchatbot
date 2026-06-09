import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAuthConfig } from './config'

/**
 * Supabase client for Next.js Server Components / layouts.
 *
 * Server Components CANNOT set cookies during render (only Route Handlers and
 * Server Actions can). Token refresh is therefore handled entirely by the
 * proxy/middleware before the request reaches a server component. Here we make
 * `setAll` a no-op so that `getClaims()`/`getUser()` never throw inside a
 * render. This is the pattern documented by Supabase for the App Router.
 *
 * Use this only for read-time guards (e.g. layout auth checks). For Route
 * Handlers that need to propagate refreshed cookies, use
 * `createSupabaseRouteClient` instead.
 */
export async function createSupabaseServerComponentClient() {
  const config = getSupabaseAuthConfig()
  const cookieStore = await cookies()

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      // No-op: cookie writes are not allowed in server components.
      // Refresh is handled by middleware/proxy before render.
      setAll() {
        /* intentionally empty */
      },
    },
  })
}
