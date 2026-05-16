import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  type QuickPromptRow,
  isSupportedWidgetQuickPromptIntent,
  normalizeWidgetQuickPromptIntent,
  mapWidgetQuickPromptRow,
} from '@/lib/widget/quick-prompts'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from('quick_prompts')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinic.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Quick prompt not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.label !== undefined) data.label = String(body.label).trim()
    if (body.intent !== undefined) {
      const normalized = normalizeWidgetQuickPromptIntent(String(body.intent))
      if (!isSupportedWidgetQuickPromptIntent(normalized)) {
        return NextResponse.json({ error: 'Unsupported intent value.' }, { status: 400 })
      }
      data.intent = normalized
    }
    if (body.sortOrder !== undefined) data.sort_order = Number(body.sortOrder) || 99
    if (body.isActive !== undefined) data.is_active = Boolean(body.isActive)

    const { data: updated, error } = await supabase
      .from('quick_prompts')
      .update(data)
      .eq('id', id)
      .eq('clinic_id', clinic.id)
      .select('id,clinic_id,label,intent,sort_order,is_active,created_at,updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update quick prompt' }, { status: 400 })
    }

    const promptOptions = { whatsapp: clinic.whatsapp || null }
    return NextResponse.json(mapWidgetQuickPromptRow(updated as QuickPromptRow, promptOptions))
  } catch (error) {
    console.error('Error updating quick prompt:', error)
    return NextResponse.json({ error: 'Failed to update quick prompt' }, { status: 500 })
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
    const { id } = await params
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from('quick_prompts')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinic.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Quick prompt not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('quick_prompts')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinic.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete quick prompt' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Quick prompt deleted successfully' })
  } catch (error) {
    console.error('Error deleting quick prompt:', error)
    return NextResponse.json({ error: 'Failed to delete quick prompt' }, { status: 500 })
  }
}
