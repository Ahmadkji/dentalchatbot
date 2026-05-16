import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
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

async function getServiceForClinic(serviceId: string, clinicId: string, supabase: NonNullable<Awaited<ReturnType<typeof requireAuth>>['supabase']>) {
  const { data, error } = await supabase
    .from('services')
    .select('id,clinic_id,name,description,category,price_amount,price_currency,pricing_note,duration_minutes,is_active,sort_order,created_at,updated_at')
    .eq('id', serviceId)
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function PATCH(request: NextRequest, context: RouteContext<'/api/services/[id]'>) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const serviceId = params.id
    const current = await getCurrentClinic(supabase, user)

    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage services.' }, { status: 403 })
    }

    const existing = await getServiceForClinic(serviceId, current.clinic.id, supabase)
    if (!existing) {
      return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = serviceCreateSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid service payload.' }, { status: 400 })
    }

    const payload = normalizeServiceInput({
      name: parsed.data.name ?? String(existing.name),
      description: parsed.data.description ?? (existing.description as string | null),
      category: parsed.data.category ?? (existing.category as string | null),
      price_amount: parsed.data.price_amount ?? (existing.price_amount as number | null),
      price_currency: parsed.data.price_currency ?? (existing.price_currency as string | null),
      pricing_note: parsed.data.pricing_note ?? (existing.pricing_note as string | null),
      duration_minutes: parsed.data.duration_minutes ?? Number(existing.duration_minutes),
      is_active: parsed.data.is_active ?? Boolean(existing.is_active),
      sort_order: parsed.data.sort_order ?? Number(existing.sort_order),
    })

    const { data, error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', serviceId)
      .eq('clinic_id', current.clinic.id)
      .select('id,clinic_id,name,description,category,price_amount,price_currency,pricing_note,duration_minutes,is_active,sort_order,created_at,updated_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A service with that name already exists for this clinic.' }, { status: 409 })
      }

      return NextResponse.json({ error: error.message || 'Failed to update service.' }, { status: 400 })
    }

    await Promise.allSettled([
      supabase.rpc('refresh_clinic_profile_status', { p_clinic_id: current.clinic.id }),
      supabase.from('clinic_profile_audit_logs').insert({
        clinic_id: current.clinic.id,
        actor_user_id: user.id,
        event: 'service_updated',
        entity_type: 'service',
        entity_id: serviceId,
        metadata: { fields: Object.keys(parsed.data) },
      }),
    ])

    return NextResponse.json(mapService(data as Record<string, unknown>))
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext<'/api/services/[id]'>) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const serviceId = params.id
    const current = await getCurrentClinic(supabase, user)

    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage services.' }, { status: 403 })
    }

    const existing = await getServiceForClinic(serviceId, current.clinic.id, supabase)
    if (!existing) {
      return NextResponse.json({ error: 'Service not found.' }, { status: 404 })
    }

    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', serviceId)
      .eq('clinic_id', current.clinic.id)

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to deactivate service.' }, { status: 400 })
    }

    await Promise.allSettled([
      supabase.rpc('refresh_clinic_profile_status', { p_clinic_id: current.clinic.id }),
      supabase.from('clinic_profile_audit_logs').insert({
        clinic_id: current.clinic.id,
        actor_user_id: user.id,
        event: 'service_deactivated',
        entity_type: 'service',
        entity_id: serviceId,
        metadata: { previousName: existing.name },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deactivating service:', error)
    return NextResponse.json({ error: 'Failed to deactivate service' }, { status: 500 })
  }
}
