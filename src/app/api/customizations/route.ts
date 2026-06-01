import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  buildCustomizationSettingsRows,
  CUSTOMIZATION_DEFAULTS,
  mapCustomizationSettings,
} from '@/lib/customizations/settings'

const settingsSchema = z.object({
  fallback_message: z.string().trim().min(1).max(600),
  chat_mode: z.enum(['human', 'ai']),
  collect_user_details: z.enum(['mandatory', 'optional', 'none']),
  disable_smart_followup: z.boolean(),
  smart_followup_count: z.number().int().min(1).max(10),
})

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const clinicId = current.clinic.id

    const [botResult, settingsResult] = await Promise.all([
      supabase
        .from('bot_settings')
        .select('fallback_message')
        .eq('clinic_id', clinicId)
        .maybeSingle(),
      supabase
        .from('clinic_settings')
        .select('key,value')
        .eq('clinic_id', clinicId)
        .in('key', [
          'chat_mode',
          'collect_user_details',
          'disable_smart_followup',
          'smart_followup_count',
          'lead_collection_enabled',
        ]),
    ])

    if (botResult.error) {
      return NextResponse.json({ error: 'Failed to load customizations' }, { status: 500 })
    }

    if (settingsResult.error) {
      return NextResponse.json({ error: 'Failed to load customizations' }, { status: 500 })
    }

    const settings = mapCustomizationSettings({
      fallbackMessage: botResult.data?.fallback_message || CUSTOMIZATION_DEFAULTS.fallback_message,
      rows: (settingsResult.data ?? []).map((row) => ({
        key: row.key as string,
        value: row.value as string,
      })),
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[customizations:GET] Failed to load customizations', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to load customizations' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can update customizations.' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = settingsSchema.safeParse(body?.settings)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid customizations payload.' },
        { status: 400 },
      )
    }

    const clinicId = current.clinic.id
    const settings = parsed.data

    // Upsert keeps this route resilient even if a clinic predates onboarding defaults.
    const { error: botError } = await supabase
      .from('bot_settings')
      .upsert(
        {
          clinic_id: clinicId,
          fallback_message: settings.fallback_message,
        },
        { onConflict: 'clinic_id' },
      )

    if (botError) {
      return NextResponse.json({ error: 'Failed to update fallback message' }, { status: 500 })
    }

    const rows = buildCustomizationSettingsRows(clinicId, settings)

    const { error: settingsError } = await supabase
      .from('clinic_settings')
      .upsert(rows, { onConflict: 'clinic_id,key' })

    if (settingsError) {
      return NextResponse.json({ error: 'Failed to update customizations' }, { status: 500 })
    }

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('[customizations:PATCH] Failed to update customizations', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to update customizations' }, { status: 500 })
  }
}
