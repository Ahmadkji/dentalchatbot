import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  type ClinicSettingKey,
  listClinicSettings,
  mapLeadSettings,
  normalizeLeadSettingsInput,
  updateClinicSetting,
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

    const allSettings = await listClinicSettings(supabase, clinic.id)
    return NextResponse.json({ settings: mapLeadSettings(allSettings) })
  } catch (error) {
    console.error('Error fetching lead settings:', error)
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

    await Promise.all(
      Object.entries(normalized).map(([key, value]) =>
        updateClinicSetting(supabase, clinicId, key as ClinicSettingKey, value),
      ),
    )

    const refreshed = await listClinicSettings(supabase, clinicId)
    return NextResponse.json({ success: true, settings: mapLeadSettings(refreshed) })
  } catch (error) {
    console.error('Error updating lead settings:', error)
    return NextResponse.json(
      { error: 'Failed to update lead settings' },
      { status: 500 },
    )
  }
}
