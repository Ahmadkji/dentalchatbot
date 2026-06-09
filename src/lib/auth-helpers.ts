import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { NextResponse } from 'next/server'

/**
 * Verify the authenticated user from server-side cookies.
 * Use this in every protected API route handler.
 *
 * Returns the Supabase client and the authenticated user.
 * If no user is found, returns a 401 response.
 *
 * Usage:
 *   const { user, supabase, error } = await requireAuth()
 *   if (error) return error
 */
export async function requireAuth() {
  const supabase = await createSupabaseRouteClient()

  if (!supabase) {
    return {
      user: null as null,
      supabase: null as null,
      error: NextResponse.json(
        { error: 'Auth configuration missing' },
        { status: 500 }
      ),
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.warn('[auth:requireAuth] Authentication failed', {
      hasError: Boolean(error),
      errorMessage: error?.message ?? 'No user returned',
      errorCode: error?.status ?? null,
    })
    return {
      user: null as null,
      supabase,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  return { user, supabase, error: null } as const
}
