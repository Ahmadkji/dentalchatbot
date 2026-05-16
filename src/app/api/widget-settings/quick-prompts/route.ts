import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  WIDGET_QUICK_PROMPT_INTENTS,
  type QuickPromptRow,
  isSupportedWidgetQuickPromptIntent,
  normalizeWidgetQuickPromptIntent,
  mapWidgetQuickPromptRow,
} from '@/lib/widget/quick-prompts'

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data: prompts, error } = await supabase
      .from('quick_prompts')
      .select('id,clinic_id,label,intent,sort_order,is_active,created_at,updated_at')
      .eq('clinic_id', clinic.id)
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch quick prompts' }, { status: 400 })
    }

    const promptOptions = { whatsapp: clinic.whatsapp || null }

    return NextResponse.json((prompts as QuickPromptRow[]).map((row) => mapWidgetQuickPromptRow(row, promptOptions)))
  } catch (error) {
    console.error('Error fetching quick prompts:', error)
    return NextResponse.json({ error: 'Failed to fetch quick prompts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const body = await request.json()
    const { label, intent, sortOrder, isActive } = body

    if (!label?.trim()) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }

    const normalizedIntent = String(intent || label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    if (!isSupportedWidgetQuickPromptIntent(normalizedIntent)) {
      return NextResponse.json(
        { error: 'Unsupported intent value.' },
        { status: 400 },
      )
    }

    const { data: prompt, error } = await supabase
      .from('quick_prompts')
      .insert({
        clinic_id: clinic.id,
        label: label.trim(),
        intent: normalizedIntent,
        sort_order: Number(sortOrder) || 99,
        is_active: isActive !== undefined ? Boolean(isActive) : true,
      })
      .select('id,clinic_id,label,intent,sort_order,is_active,created_at,updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create quick prompt' }, { status: 400 })
    }

    const promptOptions = { whatsapp: clinic.whatsapp || null }
    return NextResponse.json(mapWidgetQuickPromptRow(prompt as QuickPromptRow, promptOptions), { status: 201 })
  } catch (error) {
    console.error('Error creating quick prompt:', error)
    return NextResponse.json({ error: 'Failed to create quick prompt' }, { status: 500 })
  }
}
