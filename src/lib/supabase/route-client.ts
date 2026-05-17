import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAuthConfig } from './config'

function applyCookieDefaults(
  options: Parameters<NextResponse['cookies']['set']>[2] | undefined
) {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: options?.secure ?? process.env.NODE_ENV === 'production',
  }
}

export async function createSupabaseRouteClient(response?: NextResponse) {
  const config = getSupabaseAuthConfig()

  const cookieStore = await cookies()

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headers = {}) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const normalizedOptions = applyCookieDefaults(options)

          if (response) {
            response.cookies.set(name, value, normalizedOptions)
            return
          }

          cookieStore.set(name, value, normalizedOptions)
        })

        if (response) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
        }
      },
    },
  })
}
