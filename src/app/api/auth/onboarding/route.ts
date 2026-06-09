import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/security'
import { consumeDistributedRateLimit } from '@/lib/rate-limit'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { copyResponseCookies, setPrivateNoStore } from '@/lib/auth/response'

const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(80),
  clinicName: z.string().trim().min(2, 'Clinic name must be at least 2 characters.').max(120),
  country: z.string().trim().min(2, 'Country is required.').max(80),
  city: z.string().trim().min(2, 'City is required.').max(80),
  timezone: z.string().trim().refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Select a valid timezone.'),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format, for example +923001234567.'),
  whatsapp: z.string().trim().optional(),
  websiteUrl: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.whatsapp && !/^\+[1-9]\d{7,14}$/.test(value.whatsapp)) {
    ctx.addIssue({
      code: 'custom',
      path: ['whatsapp'],
      message: 'WhatsApp must be in E.164 format, for example +923001234567.',
    })
  }

  if (value.websiteUrl) {
    try {
      const url = new URL(value.websiteUrl)
      if (url.protocol !== 'https:' || !url.hostname.includes('.')) {
        throw new Error('Invalid website URL')
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['websiteUrl'],
        message: 'Website URL must be a valid https:// URL.',
      })
    }
  }
})

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

async function requireSession(request: Request) {
  const cookieResponse = new NextResponse()
  const supabase = await createSupabaseRouteClient(cookieResponse)

  if (!supabase) {
    console.error('[auth:onboarding] Auth configuration missing')
    return { cookieResponse, supabase: null as null, user: null as null, error: buildResponse({ error: 'Auth configuration missing.' }, 500) }
  }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    console.warn('[auth:onboarding] Session validation failed', {
      hasError: Boolean(error),
      errorMessage: error?.message ?? 'No user returned',
      errorCode: error?.status ?? null,
    })
    return { cookieResponse, supabase, user: null as null, error: buildResponse({ error: 'Session expired.' }, 401) }
  }

  return { cookieResponse, supabase, user, error: null }
}

export async function POST(request: Request) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch (originError) {
    console.error('[auth:onboarding] CSRF origin check failed', {
      origin: request.headers.get('origin'),
      host: url.host,
      error: originError instanceof Error ? originError.message : String(originError),
    })
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const payload = await request.json().catch(() => null)
  const parsed = onboardingSchema.safeParse(payload)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return buildResponse({ error: firstIssue?.message ?? 'Request body is required.' }, 400)
  }

  const { cookieResponse, supabase, user, error } = await requireSession(request)
  if (error || !supabase || !user) {
    return error ?? buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  const onboardingRateLimit = await consumeDistributedRateLimit(
    `onboarding:${user.id}`,
    3,
    15 * 60 * 1000,
    1,
    false,
  )

  if (!onboardingRateLimit.allowed) {
    const response = buildResponse(
      {
        error: 'Too many requests. Please try again later.',
        resetAt: onboardingRateLimit.resetAt,
      },
      429,
    )
    response.headers.set(
      'Retry-After',
      String(Math.max(1, Math.ceil((onboardingRateLimit.resetAt - Date.now()) / 1000))),
    )
    return response
  }

  const websiteUrl = parsed.data.websiteUrl
    ? new URL(parsed.data.websiteUrl).origin
    : null

  const { data, error: rpcError } = await supabase.rpc('complete_onboarding', {
    p_full_name: parsed.data.fullName,
    p_clinic_name: parsed.data.clinicName,
    p_country: parsed.data.country,
    p_city: parsed.data.city,
    p_timezone: parsed.data.timezone,
    p_phone: parsed.data.phone,
    p_whatsapp: parsed.data.whatsapp || null,
    p_website_url: websiteUrl,
  })

  if (rpcError) {
    console.error('[auth:onboarding] Onboarding RPC failed', {
      error: rpcError.message,
      code: rpcError.code ?? null,
      details: rpcError.details ?? null,
    })
    return buildResponse({ error: rpcError.message || 'Failed to create clinic workspace. Please try again.' }, 400)
  }

  const response = buildResponse({ ok: true, clinicId: data?.clinic_id ?? null }, 200)
  return copyResponseCookies(cookieResponse, response)
}
