import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { approveClinicImportSession } from '@/lib/clinic-imports'

export async function POST(
  request: NextRequest,
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
      return NextResponse.json({ error: 'Only owners and admins can approve clinic imports.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const approvals = Array.isArray(body?.approved_fields)
      ? body.approved_fields
      : []

    if (approvals.length === 0) {
      return NextResponse.json({ error: 'approved_fields must contain at least one reviewed field.' }, { status: 400 })
    }

    const approved = await approveClinicImportSession(
      supabase,
      current.clinic.id,
      user.id,
      id,
      approvals,
    )

    return NextResponse.json(approved)
  } catch (error) {
    console.error('Error approving clinic import session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve clinic import.' },
      { status: 500 },
    )
  }
}
