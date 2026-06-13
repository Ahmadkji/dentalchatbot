import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  type ClinicSettingKey,
  CLINIC_SETTING_DEFAULTS,
  listClinicSettings,
  mapLeadSettings,
  normalizeLeadSettingsInput,
} from '@/lib/clinics/settings'
import { getHumanHandoffRecipientConfiguration } from '@/lib/human-handoff/config'

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const allSettings = await listClinicSettings(supabase, clinic.id)
    return NextResponse.json({ settings: mapLeadSettings(allSettings) })
  } catch (error) {
    console.error('[lead-settings:GET] Failed to fetch lead settings', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to fetch lead settings' },
      { status: 500 },
    )
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
      return NextResponse.json({ error: 'Only owners and admins can update lead settings.' }, { status: 403 })
    }

    const clinicId = current.clinic.id

    const { settings } = (await request.json().catch(() => ({}))) as {
      settings?: Record<string, unknown>
    }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 },
      )
    }

    const normalized = normalizeLeadSettingsInput(settings)
    if (Object.keys(normalized).length === 0) {
      return NextResponse.json(
        { error: 'No valid lead settings were provided.' },
        { status: 400 },
      )
    }

    const currentSettings = await listClinicSettings(supabase, clinicId)
    const effectiveSettings = currentSettings.map((row) =>
      row.key in normalized
        ? { key: row.key, value: String(normalized[row.key as keyof typeof normalized] ?? row.value) }
        : { key: row.key, value: row.value },
    )
    const chatMode = effectiveSettings.find((row) => String(row.key) === 'chat_mode')?.value ?? 'ai'

    if (chatMode === 'human') {
      const recipientConfiguration = getHumanHandoffRecipientConfiguration(effectiveSettings)
      if (!recipientConfiguration.ready) {
        console.warn('[lead-settings:PUT] Rejected lead settings change because human mode would lose recipients', {
          userId: user.id,
          clinicId,
          reason: recipientConfiguration.reason,
        })
        return NextResponse.json(
          { error: recipientConfiguration.message || 'Human handoff requires notification recipients.' },
          { status: 400 },
        )
      }
    }

    // Batch upsert all settings in a single DB call instead of N individual writes.
    // This reduces the number of Supabase round-trips from (N writes + 1 read)
    // to (1 write + 1 read), cutting latency significantly when multiple settings change.
    // Include category/description so the INSERT path (for legacy clinics missing rows)
    // doesn't fail on the NOT NULL category constraint.
    const defaultsMap = new Map(CLINIC_SETTING_DEFAULTS.map((d) => [d.key, d]))
    const rows = Object.entries(normalized).map(([key, value]) => {
      const def = defaultsMap.get(key as ClinicSettingKey)
      return {
        clinic_id: clinicId,
        key,
        value: value as string,
        category: def?.category ?? 'lead-collection',
        description: def?.description ?? '',
      }
    })
    const { error: upsertError } = await supabase
      .from('clinic_settings')
      .upsert(rows, { onConflict: 'clinic_id,key' })

    if (upsertError) {
      console.error('[lead-settings:PUT] Batch upsert failed', {
        userId: user.id,
        clinicId,
        error: upsertError instanceof Error ? upsertError.message : String(upsertError),
      })
      return NextResponse.json({ error: 'Failed to update lead settings' }, { status: 500 })
    }

    const refreshed = await listClinicSettings(supabase, clinicId)
    return NextResponse.json({ success: true, settings: mapLeadSettings(refreshed) })
  } catch (error) {
    console.error('[lead-settings:PUT] Failed to update lead settings', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to update lead settings' },
      { status: 500 },
    )
  }
}
