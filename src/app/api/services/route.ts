import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic, getClinicServices } from '@/lib/clinics/current'
import { normalizeServiceInput, serviceCreateSchema } from '@/lib/clinics/validation'

function mapService(row: Record<string, unknown>) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    pricingNote: row.pricing_note,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    price: row.price_amount !== null && row.price_amount !== undefined && row.price_currency
      ? `${row.price_currency} ${row.price_amount}`
      : row.pricing_note ?? null,
  }
}

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

    return NextResponse.json({ services: services.map((service) => mapService(service as Record<string, unknown>)) })
  } catch (error) {
    console.error('Error fetching services:', error)
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
      .select('id,clinic_id,name,description,category,price_amount,price_currency,pricing_note,duration_minutes,is_active,sort_order,created_at,updated_at')
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

    return NextResponse.json(mapService(data as Record<string, unknown>), { status: 201 })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
