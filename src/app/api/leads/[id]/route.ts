import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getLeadConflictMessage, leadPatchSchema, mapLeadRow } from '@/lib/leads/lead-contract'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    // Verify lead belongs to this clinic
    const adminClient = createSupabaseAdminClient()
    const { data: existing, error: findError } = await adminClient
      .from('leads')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const parsed = leadPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid lead payload' },
        { status: 400 },
      )
    }

    const { data: lead, error } = await adminClient
      .from('leads')
      .update(parsed.data)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      const conflictMessage = getLeadConflictMessage(error)
      if (conflictMessage) {
        return NextResponse.json({ error: conflictMessage }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json(mapLeadRow(lead))
  } catch (error) {
    console.error('[leads:PATCH] Failed to update lead', {
      leadId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const adminClient = createSupabaseAdminClient()

    // Verify ownership
    const { data: existing, error: findError } = await adminClient
      .from('leads')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('leads')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[leads:DELETE] Failed to delete lead', {
      leadId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
