import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { DAY_NAMES, clinicHoursReplaceSchema, normalizeClinicHours } from '@/lib/clinics/hours'
import { getCurrentClinic, getClinicHours } from '@/lib/clinics/current'

function withDayNames(hours: Awaited<ReturnType<typeof getClinicHours>>) {
  return Array.from({ length: 7 }, (_, index) => {
    const row = hours.find((entry) => entry.day_of_week === index)
    return {
      day_of_week: index,
      day_name: DAY_NAMES[index],
      is_open: row?.is_open ?? false,
      open_time: row?.open_time ?? null,
      close_time: row?.close_time ?? null,
      break_start_time: row?.break_start_time ?? null,
      break_end_time: row?.break_end_time ?? null,
      notes: row?.notes ?? null,
    }
  })
}

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const hours = await getClinicHours(supabase, clinic.id)
    return NextResponse.json(withDayNames(hours))
  } catch (error) {
    console.error('Error fetching clinic hours:', error)
    return NextResponse.json({ error: 'Failed to fetch clinic hours' }, { status: 500 })
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
      return NextResponse.json({ error: 'Only owners and admins can update clinic hours.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = clinicHoursReplaceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid clinic hours payload.' }, { status: 400 })
    }

    const normalizedHours = normalizeClinicHours(parsed.data.hours)
    const { data, error } = await supabase.rpc('replace_clinic_hours', {
      p_clinic_id: current.clinic.id,
      p_hours: normalizedHours,
    })

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to replace clinic hours.' }, { status: 400 })
    }

    return NextResponse.json(withDayNames((data ?? []) as Awaited<ReturnType<typeof getClinicHours>>))
  } catch (error) {
    console.error('Error replacing clinic hours:', error)
    return NextResponse.json({ error: 'Failed to update clinic hours' }, { status: 500 })
  }
}
