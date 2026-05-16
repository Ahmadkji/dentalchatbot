import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinicSnapshot } from '@/lib/clinics/current'
import { clinicProfileUpdateSchema, normalizeClinicProfileUpdate } from '@/lib/clinics/validation'

const clinicSelect =
  'id,name,slug,country,city,address,timezone,phone,whatsapp,website_url,map_link,pricing_notes,appointment_rules,emergency_instructions,status,owner_id,profile_completed,is_live'

function mapClinicForResponse(snapshot: Awaited<ReturnType<typeof getCurrentClinicSnapshot>>) {
  if (!snapshot.clinic) {
    return null
  }

  return {
    clinic: {
      id: snapshot.clinic.id,
      name: snapshot.clinic.name,
      slug: snapshot.clinic.slug,
      country: snapshot.clinic.country,
      city: snapshot.clinic.city,
      address: snapshot.clinic.address,
      timezone: snapshot.clinic.timezone,
      phone: snapshot.clinic.phone,
      whatsapp: snapshot.clinic.whatsapp,
      website_url: snapshot.clinic.website_url,
      map_link: snapshot.clinic.map_link,
      pricing_notes: snapshot.clinic.pricing_notes,
      appointment_rules: snapshot.clinic.appointment_rules,
      emergency_instructions: snapshot.clinic.emergency_instructions,
      profile_completed: snapshot.clinic.profile_completed,
      is_live: snapshot.clinic.is_live,
      status: snapshot.clinic.status,
    },
    readiness: snapshot.readiness,
  }
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

    return NextResponse.json(mapClinicForResponse(snapshot))
  } catch (error) {
    console.error('Error fetching current clinic:', error)
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

    const body = await request.json().catch(() => null)
    const parsed = clinicProfileUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid clinic profile update.' }, { status: 400 })
    }

    const updateData = normalizeClinicProfileUpdate(parsed.data)
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No editable clinic fields were provided.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('clinics')
      .update(updateData)
      .eq('id', snapshot.clinic.id)
      .select(clinicSelect)
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'That clinic slug is already in use.' }, { status: 409 })
      }

      return NextResponse.json({ error: updateError.message || 'Failed to update clinic profile.' }, { status: 400 })
    }

    const logMetadata = {
      fields: Object.keys(updateData),
    }

    const results = await Promise.allSettled([
      supabase.rpc('refresh_clinic_profile_status', { p_clinic_id: snapshot.clinic.id }),
      supabase.from('clinic_profile_audit_logs').insert({
        clinic_id: snapshot.clinic.id,
        actor_user_id: user.id,
        event: 'clinic_profile_updated',
        entity_type: 'clinic_profile',
        metadata: logMetadata,
      }),
    ])

    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('Post-update clinic task failed:', result.reason)
      }
    })

    const refreshed = await getCurrentClinicSnapshot(supabase, user)
    return NextResponse.json(mapClinicForResponse(refreshed))
  } catch (error) {
    console.error('Error updating current clinic:', error)
    return NextResponse.json({ error: 'Failed to update clinic profile' }, { status: 500 })
  }
}
