import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  leadCustomFieldSchema,
  mapLeadCustomField,
  normalizeLeadCustomFieldInput,
} from '@/lib/clinics/settings'

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('lead_custom_fields')
      .select('id,clinic_id,label,field_type,required,options,placeholder,sort_order,created_at,updated_at')
      .eq('clinic_id', clinic.id)
      .order('sort_order', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ fields: (data ?? []).map(mapLeadCustomField) })
  } catch (error) {
    console.error('Error fetching custom fields:', error)
    return NextResponse.json(
      { error: 'Failed to fetch custom fields' },
      { status: 500 },
    )
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
      return NextResponse.json({ error: 'Only owners and admins can manage lead custom fields.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = leadCustomFieldSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid custom field payload.' },
        { status: 400 },
      )
    }

    const { count, error: countError } = await supabase
      .from('lead_custom_fields')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', current.clinic.id)

    if (countError) {
      throw countError
    }

    const payload = normalizeLeadCustomFieldInput({
      ...parsed.data,
      order: parsed.data.order ?? (count ?? 0) + 1,
    })

    const { data, error } = await supabase
      .from('lead_custom_fields')
      .insert({
        clinic_id: current.clinic.id,
        ...payload,
      })
      .select('id,clinic_id,label,field_type,required,options,placeholder,sort_order,created_at,updated_at')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapLeadCustomField(data), { status: 201 })
  } catch (error) {
    console.error('Error creating custom field:', error)
    return NextResponse.json(
      { error: 'Failed to create custom field' },
      { status: 500 },
    )
  }
}
