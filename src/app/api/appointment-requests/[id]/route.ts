import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const appointmentPatchSchema = z.object({
  status: z.enum(['requested', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  name: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  preferredDate: z.string().trim().max(32).optional(),
  preferredTime: z.string().trim().max(32).optional(),
  reason: z.string().trim().max(2000).optional(),
  preferredDoctor: z.string().trim().max(160).optional(),
}).strict()

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

    const body = await request.json().catch(() => null)
    const parsed = appointmentPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

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
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone
    if (parsed.data.preferredDate !== undefined) updateData.preferred_date = parsed.data.preferredDate
    if (parsed.data.preferredTime !== undefined) updateData.preferred_time = parsed.data.preferredTime
    if (parsed.data.reason !== undefined) updateData.reason = parsed.data.reason
    if (parsed.data.preferredDoctor !== undefined) updateData.preferred_doctor = parsed.data.preferredDoctor

    const { data: appointmentRequest, error } = await adminClient
      .from('appointment_requests')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(appointmentRequest)
  } catch (error) {
    console.error('[appointment-requests:PATCH] Failed to update appointment request', {
      appointmentRequestId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
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
  const { id } = await params

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

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
    console.error('[appointment-requests:DELETE] Failed to delete appointment request', {
      appointmentRequestId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to delete appointment request' }, { status: 500 })
  }
}
