import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { setPrivateNoStore } from '@/lib/auth/response'
import { accountProfileUpdateSchema, normalizeAccountProfileUpdate } from '@/lib/account-profile'
import { assertSameOrigin } from '@/lib/security'

const profileSelect = 'id,email,full_name,timezone,onboarding_completed,default_clinic_id,created_at,updated_at'

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

function mapFallbackProfile(userId: string, email: string | null | undefined) {
  return {
    id: userId,
    email: email ?? '',
    full_name: null,
    timezone: 'UTC',
    onboarding_completed: false,
    default_clinic_id: null,
    created_at: null,
    updated_at: null,
  }
}

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return setPrivateNoStore(authError)
  if (!user || !supabase) return buildResponse({ error: 'Unauthorized' }, 401)

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    return buildResponse(data ?? mapFallbackProfile(user.id, user.email))
  } catch (error) {
    console.error('[profile:GET] Failed to fetch profile', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return buildResponse({ error: 'Failed to fetch profile.' }, 500)
  }
}

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch (originError) {
    console.error('[profile:PATCH] CSRF origin check failed', {
      origin: request.headers.get('origin'),
      host: url.host,
      error: originError instanceof Error ? originError.message : String(originError),
    })
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return setPrivateNoStore(authError)
  if (!user || !supabase) return buildResponse({ error: 'Unauthorized' }, 401)

  try {
    const payload = await request.json().catch(() => null)
    const parsed = accountProfileUpdateSchema.safeParse(payload)

    if (!parsed.success) {
      return buildResponse({ error: parsed.error.issues[0]?.message ?? 'Invalid profile update.' }, 400)
    }

    const updateData = normalizeAccountProfileUpdate(parsed.data)
    if (Object.keys(updateData).length === 0) {
      return buildResponse({ error: 'No editable profile fields were provided.' }, 400)
    }

    const authEmail = user.email?.trim()
    if (!authEmail) {
      return buildResponse({ error: 'Authenticated email is missing.' }, 400)
    }
    updateData.email = authEmail

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: authEmail,
          ...updateData,
        },
        { onConflict: 'id' },
      )
      .select(profileSelect)
      .single()

    if (error) {
      return buildResponse({ error: error.message || 'Failed to update profile.' }, 400)
    }

    return buildResponse(data)
  } catch (error) {
    console.error('[profile:PATCH] Failed to update profile', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return buildResponse({ error: 'Failed to update profile.' }, 500)
  }
}
