import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic, getClinicServices } from '@/lib/clinics/current'
import { normalizeServiceInput, serviceCreateSchema } from '@/lib/clinics/validation'
import { mapServiceRow, serviceSelectFields } from '@/lib/clinics/services'

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const status = request.nextUrl.searchParams.get('status')
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true'

    let services = await getClinicServices(supabase, clinic.id, { includeInactive: includeInactive || status === 'inactive' })

    if (status === 'active') {
      services = services.filter((service) => service.is_active)
    } else if (status === 'inactive') {
      services = services.filter((service) => !service.is_active)
    }

    return NextResponse.json({
      defaultCurrency: clinic.default_currency,
      services: services.map((service) => mapServiceRow(service as Record<string, unknown>, clinic.default_currency)),
    })
  } catch (error) {
    console.error('[services:GET] Failed to fetch services', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

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
      return NextResponse.json({ error: 'Only owners and admins can manage services.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = serviceCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid service payload.' }, { status: 400 })
    }

    const payload = normalizeServiceInput(parsed.data)
    const { data, error } = await supabase
      .from('services')
      .insert({
        clinic_id: current.clinic.id,
        ...payload,
      })
      .select(serviceSelectFields)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A service with that name already exists for this clinic.' }, { status: 409 })
      }

      return NextResponse.json({ error: error.message || 'Failed to create service.' }, { status: 400 })
    }

    await Promise.allSettled([
      supabase.rpc('refresh_clinic_profile_status', { p_clinic_id: current.clinic.id }),
      supabase.from('clinic_profile_audit_logs').insert({
        clinic_id: current.clinic.id,
        actor_user_id: user.id,
        event: 'service_created',
        entity_type: 'service',
        entity_id: data.id,
        metadata: { name: data.name },
      }),
    ])

    return NextResponse.json(mapServiceRow(data as Record<string, unknown>, current.clinic.default_currency), { status: 201 })
  } catch (error) {
    console.error('[services:POST] Failed to create service', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
