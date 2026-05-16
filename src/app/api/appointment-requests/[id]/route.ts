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
    const { status, name, phone, preferredDate, preferredTime, reason, preferredDoctor } = body

    const adminClient = createSupabaseAdminClient()

    // Verify belongs to this clinic
    const { data: existing, error: findError } = await adminClient
      .from('appointment_requests')
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
    if (preferredDate !== undefined) updateData.preferred_date = preferredDate
    if (preferredTime !== undefined) updateData.preferred_time = preferredTime
    if (reason !== undefined) updateData.reason = reason
    if (preferredDoctor !== undefined) updateData.preferred_doctor = preferredDoctor

    const { data: appointmentRequest, error } = await adminClient
      .from('appointment_requests')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(appointmentRequest)
  } catch (error) {
    console.error('Error updating appointment request:', error)
    return NextResponse.json({ error: 'Failed to update appointment request' }, { status: 500 })
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

    const { data: existing, error: findError } = await adminClient
      .from('appointment_requests')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('appointment_requests')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment request:', error)
    return NextResponse.json({ error: 'Failed to delete appointment request' }, { status: 500 })
  }
}
