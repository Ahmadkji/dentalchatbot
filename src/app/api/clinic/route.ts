import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinicSnapshot, mapClinicToAppProfile } from '@/lib/clinics/current'
import { clinicProfileUpdateSchema, normalizeClinicProfileUpdate } from '@/lib/clinics/validation'

function toCompatibilityBody(body: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {}

  if (typeof body.name === 'string') normalized.name = body.name
  if (typeof body.slug === 'string') normalized.slug = body.slug
  if (typeof body.country === 'string') normalized.country = body.country
  if (typeof body.city === 'string') normalized.city = body.city
  if (typeof body.address === 'string') normalized.address = body.address
  if (typeof body.timezone === 'string') normalized.timezone = body.timezone
  if (typeof body.phone === 'string') normalized.phone = body.phone
  if (typeof body.primaryPhone === 'string') normalized.phone = body.primaryPhone
  if (typeof body.whatsapp === 'string') normalized.whatsapp = body.whatsapp
  if (typeof body.whatsappNumber === 'string') normalized.whatsapp = body.whatsappNumber
  if (typeof body.website_url === 'string') normalized.website_url = body.website_url
  if (typeof body.websiteUrl === 'string') normalized.website_url = body.websiteUrl
  if (typeof body.map_link === 'string') normalized.map_link = body.map_link
  if (typeof body.mapLink === 'string') normalized.map_link = body.mapLink
  if (typeof body.pricing_notes === 'string') normalized.pricing_notes = body.pricing_notes
  if (typeof body.pricingNotes === 'string') normalized.pricing_notes = body.pricingNotes
  if (typeof body.appointment_rules === 'string') normalized.appointment_rules = body.appointment_rules
  if (typeof body.appointmentRules === 'string') normalized.appointment_rules = body.appointmentRules
  if (typeof body.emergency_instructions === 'string') normalized.emergency_instructions = body.emergency_instructions
  if (typeof body.emergencyInstructions === 'string') normalized.emergency_instructions = body.emergencyInstructions

  return normalized
}

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snapshot = await getCurrentClinicSnapshot(supabase, user)
    if (!snapshot.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    return NextResponse.json(mapClinicToAppProfile(snapshot.clinic, snapshot.hours))
  } catch (error) {
    console.error('Error fetching clinic profile:', error)
    return NextResponse.json({ error: 'Failed to fetch clinic profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snapshot = await getCurrentClinicSnapshot(supabase, user)
    if (!snapshot.clinic || !snapshot.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(snapshot.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update clinic profile.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid clinic update payload.' }, { status: 400 })
    }

    if (body.openingHours !== undefined) {
      return NextResponse.json(
        { error: 'Clinic hours now use the structured weekly schedule. Update them through /api/clinic-hours.' },
        { status: 400 },
      )
    }

    const parsed = clinicProfileUpdateSchema.safeParse(toCompatibilityBody(body))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid clinic profile update.' }, { status: 400 })
    }

    const updateData = normalizeClinicProfileUpdate(parsed.data)
    if (typeof body.isActive === 'boolean') {
      updateData.status = body.isActive ? 'active' : 'disabled'
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No editable clinic fields were provided.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('clinics')
      .update(updateData)
      .eq('id', snapshot.clinic.id)
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'That clinic slug is already in use.' }, { status: 409 })
      }

      return NextResponse.json({ error: updateError.message || 'Failed to update clinic profile.' }, { status: 400 })
    }

    await Promise.allSettled([
      supabase.rpc('refresh_clinic_profile_status', { p_clinic_id: snapshot.clinic.id }),
      supabase.from('clinic_profile_audit_logs').insert({
        clinic_id: snapshot.clinic.id,
        actor_user_id: user.id,
        event: 'clinic_profile_updated',
        entity_type: 'clinic_profile',
        metadata: { fields: Object.keys(updateData), compatibilityRoute: true },
      }),
    ])

    const refreshed = await getCurrentClinicSnapshot(supabase, user)
    return NextResponse.json(mapClinicToAppProfile(refreshed.clinic!, refreshed.hours))
  } catch (error) {
    console.error('Error updating clinic profile:', error)
    return NextResponse.json({ error: 'Failed to update clinic profile' }, { status: 500 })
  }
}
