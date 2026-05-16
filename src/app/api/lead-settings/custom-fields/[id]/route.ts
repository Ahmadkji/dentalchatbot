import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  leadCustomFieldUpdateSchema,
  mapLeadCustomField,
  normalizeLeadCustomFieldInput,
} from '@/lib/clinics/settings'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = leadCustomFieldUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid custom field payload.' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('lead_custom_fields')
      .update(normalizeLeadCustomFieldInput(parsed.data))
      .eq('clinic_id', current.clinic.id)
      .eq('id', id)
      .select('id,clinic_id,label,field_type,required,options,placeholder,sort_order,created_at,updated_at')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 })
    }

    return NextResponse.json(mapLeadCustomField(data))
  } catch (error) {
    console.error('Error updating custom field:', error)
    return NextResponse.json(
      { error: 'Failed to update custom field' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const { data, error } = await supabase
      .from('lead_custom_fields')
      .delete()
      .eq('clinic_id', current.clinic.id)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting custom field:', error)
    return NextResponse.json(
      { error: 'Failed to delete custom field' },
      { status: 500 },
    )
  }
}
