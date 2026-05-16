import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { cancelClinicImportSession, getClinicImportSession } from '@/lib/clinic-imports'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { id } = await params
    const session = await getClinicImportSession(supabase, current.clinic.id, id)
    if (!session) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error fetching clinic import session:', error)
    return NextResponse.json({ error: 'Failed to load import session' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage clinic imports.' }, { status: 403 })
    }

    const { id } = await params
    await cancelClinicImportSession(supabase, current.clinic.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling clinic import session:', error)
    return NextResponse.json({ error: 'Failed to cancel import session' }, { status: 500 })
  }
}
