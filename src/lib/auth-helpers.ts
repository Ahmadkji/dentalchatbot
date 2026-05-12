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

/**
 * Check that a record belongs to the authenticated user.
 * Returns a 404 response (not 403) to avoid leaking record existence.
 * When returning null, the record is guaranteed to be non-null and owned by the user.
 *
 * Usage:
 *   const ownershipError = requireOwnership(record, user.id)
 *   if (ownershipError) return ownershipError
 *   // record is now narrowed to non-null
 */
export function requireOwnership<T extends { userId?: string }>(
  record: T | null,
  userId: string
): NextResponse | null {
  if (!record || record.userId !== userId) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  }

  return null
}
