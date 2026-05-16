import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  isKnownClinicSettingKey,
  listClinicSettings,
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

    const settings = await listClinicSettings(supabase, clinic.id)

    const grouped = settings.reduce(
      (acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = []
        }
        acc[setting.category].push(setting)
        return acc
      },
      {} as Record<string, typeof settings>,
    )

    return NextResponse.json({
      settings,
      grouped,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update settings.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const { key, id, value } = body ?? {}

    let settingKey = typeof key === 'string' ? key : null

    if (!settingKey && id) {
      const settings = await listClinicSettings(supabase, current.clinic.id)
      const byId = settings.find((setting) => setting.id === String(id))
      if (byId) {
        settingKey = byId.key
      }
    }

    if (!settingKey || value === undefined) {
      return NextResponse.json(
        { error: 'key (or id) and value are required' },
        { status: 400 },
      )
    }

    if (!isKnownClinicSettingKey(settingKey)) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 },
      )
    }

    const setting = await updateClinicSetting(
      supabase,
      current.clinic.id,
      settingKey,
      value,
    )

    return NextResponse.json(setting)
  } catch (error) {
    console.error('Error updating setting:', error)
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 },
    )
  }
}
