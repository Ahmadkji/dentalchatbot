import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  WIDGET_QUICK_PROMPT_INTENTS,
  type QuickPromptRow,
  mapWidgetQuickPromptRow,
} from '@/lib/widget/quick-prompts'

const dentalPrompts: Array<{ label: string; intent: string }> = [
  { label: 'Book Appointment', intent: WIDGET_QUICK_PROMPT_INTENTS[0] },
  { label: 'Clinic Hours', intent: WIDGET_QUICK_PROMPT_INTENTS[1] },
  { label: 'Services & Fees', intent: WIDGET_QUICK_PROMPT_INTENTS[2] },
  { label: 'Location', intent: WIDGET_QUICK_PROMPT_INTENTS[3] },
  { label: 'Talk on WhatsApp', intent: WIDGET_QUICK_PROMPT_INTENTS[4] },
  { label: 'Emergency Help', intent: WIDGET_QUICK_PROMPT_INTENTS[5] },
]

export async function POST() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { error: deleteError } = await supabase
      .from('quick_prompts')
      .delete()
      .eq('clinic_id', clinic.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to reset prompts' }, { status: 400 })
    }

    const { data: created, error: insertError } = await supabase
      .from('quick_prompts')
      .insert(dentalPrompts.map((prompt, index) => ({
        clinic_id: clinic.id,
        label: prompt.label,
        intent: prompt.intent,
        sort_order: index + 1,
        is_active: true,
      })))
      .select('id,clinic_id,label,intent,sort_order,is_active,created_at,updated_at')

    if (insertError) {
      return NextResponse.json({ error: 'Failed to reset prompts' }, { status: 400 })
    }

    const promptOptions = { whatsapp: clinic.whatsapp || null }

    return NextResponse.json(
      (created as QuickPromptRow[]).map((row) => mapWidgetQuickPromptRow(row, promptOptions))
    )
  } catch (error) {
    console.error('Error resetting dental prompts:', error)
    return NextResponse.json({ error: 'Failed to reset prompts' }, { status: 500 })
  }
}
