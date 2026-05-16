import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const body = await request.json()
    const { status, name, phone, question, preferredContact, service, preferredDate, preferredTime, message, internalNote } = body

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

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (question !== undefined) updateData.question = question
    if (preferredContact !== undefined) updateData.preferred_contact = preferredContact
    if (service !== undefined) updateData.service = service
    if (preferredDate !== undefined) updateData.preferred_date = preferredDate
    if (preferredTime !== undefined) updateData.preferred_time = preferredTime
    if (message !== undefined) updateData.message = message
    if (internalNote !== undefined) updateData.internal_note = internalNote

    const { data: lead, error } = await adminClient
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error updating lead:', error)
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

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { id } = await params

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
    console.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
