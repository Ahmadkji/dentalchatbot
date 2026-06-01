import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { normalizeServiceInput, serviceCreateSchema, serviceUpdateSchema } from '@/lib/clinics/validation'
import { mapServiceRow, serviceSelectFields } from '@/lib/clinics/services'

async function getServiceForClinic(serviceId: string, clinicId: string, supabase: NonNullable<Awaited<ReturnType<typeof requireAuth>>['supabase']>) {
  const { data, error } = await supabase
    .from('services')
    .select(serviceSelectFields)
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
    const parsed = serviceUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid service payload.' }, { status: 400 })
    }

    const mergeField = <T>(partial: T | undefined, existing: T): T =>
      partial !== undefined ? partial : existing

    const mergedInput = {
      name: mergeField(parsed.data.name, String(existing.name)),
      description: mergeField(parsed.data.description, existing.description as string | null),
      category: mergeField(parsed.data.category, existing.category as string | null),
      price_type: mergeField(parsed.data.price_type, String(existing.price_type ?? 'fixed')),
      price_amount: mergeField(parsed.data.price_amount, existing.price_amount as number | null),
      price_min_amount: mergeField(parsed.data.price_min_amount, existing.price_min_amount as number | null),
      price_max_amount: mergeField(parsed.data.price_max_amount, existing.price_max_amount as number | null),
      price_currency: mergeField(parsed.data.price_currency, existing.price_currency as string | null),
      pricing_note: mergeField(parsed.data.pricing_note, existing.pricing_note as string | null),
      duration_minutes: mergeField(parsed.data.duration_minutes, Number(existing.duration_minutes)),
      is_active: mergeField(parsed.data.is_active, Boolean(existing.is_active)),
      sort_order: mergeField(parsed.data.sort_order, Number(existing.sort_order)),
      is_price_visible_to_chatbot: mergeField(parsed.data.is_price_visible_to_chatbot, Boolean(existing.is_price_visible_to_chatbot)),
      requires_consultation: mergeField(parsed.data.requires_consultation, Boolean(existing.requires_consultation)),
    }

    const fullParsed = serviceCreateSchema.safeParse(mergedInput)
    if (!fullParsed.success) {
      return NextResponse.json({ error: fullParsed.error.issues[0]?.message ?? 'Invalid service payload.' }, { status: 400 })
    }

    const payload = normalizeServiceInput(fullParsed.data)

    const { data, error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', serviceId)
      .eq('clinic_id', current.clinic.id)
      .select(serviceSelectFields)
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

    return NextResponse.json(mapServiceRow(data as Record<string, unknown>, current.clinic.default_currency))
  } catch (error) {
    console.error('[services:PATCH] Failed to update service', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
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
    console.error('[services:DELETE] Failed to deactivate service', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to deactivate service' }, { status: 500 })
  }
}
