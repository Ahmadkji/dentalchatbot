import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/security'
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
  const parsed = onboardingSchema.safeParse(payload)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return buildResponse({ error: firstIssue?.message ?? 'Request body is required.' }, 400)
  }

  const { cookieResponse, supabase, error } = await requireSession(request)
  if (error || !supabase) {
    return error ?? buildResponse({ error: 'Auth configuration missing.' }, 500)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return buildResponse({ error: 'Session expired.' }, 401)
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
    return buildResponse({ error: rpcError.message || 'Failed to create clinic workspace. Please try again.' }, 400)
  }

  const response = buildResponse({ ok: true, clinicId: data?.clinic_id ?? null }, 200)
  return copyResponseCookies(cookieResponse, response)
}
