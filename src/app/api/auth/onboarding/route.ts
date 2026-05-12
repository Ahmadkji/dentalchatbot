import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/security'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

async function requireSession(request: Request) {
  const cookieResponse = NextResponse.next()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    return { cookieResponse, supabase: null, error: buildResponse({ error: 'Auth configuration missing.' }, 500) }
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { cookieResponse, supabase, error: buildResponse({ error: 'Session expired.' }, 401) }
  }

  return { cookieResponse, supabase, error: null }
}

export async function POST(request: Request) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch {
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    return buildResponse({ error: 'Request body is required.' }, 400)
  }

  const fullName = typeof (payload as { fullName?: string }).fullName === 'string'
    ? (payload as { fullName?: string }).fullName.trim()
    : ''
  const clinicName = typeof (payload as { clinicName?: string }).clinicName === 'string'
    ? (payload as { clinicName?: string }).clinicName.trim()
    : ''
  const timezone = typeof (payload as { timezone?: string }).timezone === 'string'
    ? (payload as { timezone?: string }).timezone
    : 'UTC'

  if (!fullName) {
    return buildResponse({ error: 'Full name is required.' }, 400)
  }

  const { cookieResponse, supabase, error } = await requireSession(request)
  if (error || !supabase) {
    return error ?? buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return buildResponse({ error: 'Session expired.' }, 401)
  }

  const updateData: Record<string, unknown> = {
    full_name: fullName,
    timezone: timezone || 'UTC',
    onboarding_completed: true,
  }

  if (clinicName) {
    updateData.clinic_name = clinicName
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (updateError) {
    return buildResponse({ error: 'Failed to save profile. Please try again.' }, 500)
  }

  const response = buildResponse({ ok: true }, 200)
  return copyResponseCookies(cookieResponse, response)
}
