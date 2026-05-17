import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { listClinicSettings } from '@/lib/clinics/settings'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const confirmSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  serviceId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  internalNote: z.string().trim().max(1000).nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const current = await getCurrentClinic(supabase, user)
  if (!current.clinic) {
    return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
  }

  const ip = getClientIp(request.headers)
  const rl = await enforceRateLimit({
    key: `appt-confirm:${current.clinic.id}:${user.id}:${ip}`,
    limit: 30,
    windowMs: 5 * 60 * 1000,
    failOpen: true,
  })
  if (rl) return rl

  const body = confirmSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', details: body.error.issues }, { status: 400 })
  }

  const { id } = await params
  const admin = createSupabaseAdminClient()

  const { data: existingRequest, error: requestLookupError } = await admin
    .from('appointment_requests')
    .select('id')
    .eq('id', id)
    .eq('clinic_id', current.clinic.id)
    .maybeSingle()

  if (requestLookupError) {
    return NextResponse.json({ error: 'Failed to load appointment request' }, { status: 500 })
  }

  if (!existingRequest) {
    return NextResponse.json({ error: 'Appointment request not found' }, { status: 404 })
  }

  const settings = await listClinicSettings(supabase, current.clinic.id)
  const slotDuration = Number(settings.find((row) => row.key === 'slot_duration')?.value || '30')
  const maxAdvanceBooking = Number(settings.find((row) => row.key === 'max_advance_booking')?.value || '60')
  const durationMinutes = body.data.durationMinutes ?? slotDuration

  const requestedDate = new Date(`${body.data.startDate}T00:00:00Z`)
  const maxDate = new Date()
  maxDate.setUTCDate(maxDate.getUTCDate() + maxAdvanceBooking)

  if (requestedDate > maxDate) {
    return NextResponse.json(
      { error: `Appointment cannot be confirmed more than ${maxAdvanceBooking} days in advance.` },
      { status: 400 },
    )
  }

  const { data, error } = await admin.rpc('confirm_appointment_request', {
    p_request_id: id,
    p_actor_user_id: user.id,
    p_start_date: body.data.startDate,
    p_start_time: body.data.startTime,
    p_duration_minutes: durationMinutes,
    p_service_id: body.data.serviceId ?? null,
    p_staff_id: body.data.staffId ?? null,
    p_internal_note: body.data.internalNote ?? null,
  })

  if (error) {
    const status = /duplicate key|double|conflict/i.test(error.message) ? 409 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json(data)
}
