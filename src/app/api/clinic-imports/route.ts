import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createClinicImportSession } from '@/lib/clinic-imports'

export async function POST(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can import clinic details.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const websiteUrl = String(body?.website_url ?? '').trim()
    if (!websiteUrl) {
      return NextResponse.json({ error: 'website_url is required' }, { status: 400 })
    }

    const created = await createClinicImportSession(
      supabase,
      current.clinic.id,
      user.id,
      websiteUrl,
    )

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating clinic import session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import clinic website details.' },
      { status: 500 },
    )
  }
}
