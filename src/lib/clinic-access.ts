import 'server-only'

import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getCurrentClinic } from '@/lib/clinics/current'
import type { createSupabaseRouteClient } from '@/lib/supabase/route-client'

type SupabaseRouteClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseRouteClient>>
>

export type ClinicRole = 'owner' | 'admin' | 'staff'

export async function requireCurrentClinicAccess(
  supabase: SupabaseRouteClient,
  user: Pick<User, 'id'>,
  allowedRoles?: ClinicRole[],
): Promise<
  | {
      current: Awaited<ReturnType<typeof getCurrentClinic>>
      error: null
    }
  | {
      current: null
      error: NextResponse
    }
> {
  const current = await getCurrentClinic(supabase, user)

  if (!current.clinic || !current.membership) {
    return {
      current: null,
      error: NextResponse.json({ error: 'Onboarding required' }, { status: 409 }),
    }
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(current.membership.role as ClinicRole)
  ) {
    return {
      current: null,
      error: NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 },
      ),
    }
  }

  return { current, error: null }
}
