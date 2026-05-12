import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAuthConfig } from './config'

function applyStrictCookieDefaults(
  options: Parameters<NextResponse['cookies']['set']>[2] | undefined
) {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: options?.secure ?? process.env.NODE_ENV === 'production',
  }
}

export async function createSupabaseRouteClient(response?: NextResponse) {
  const config = getSupabaseAuthConfig()
  if (!config) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const normalizedOptions = applyStrictCookieDefaults(options)

          if (response) {
            response.cookies.set(name, value, normalizedOptions)
            return
          }

          cookieStore.set(name, value, normalizedOptions)
        })
      },
    },
  })
}
