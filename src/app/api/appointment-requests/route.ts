import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { CHAT_SESSION_COOKIE } from '@/lib/chat/session'
import { validatePublicSessionToken, validateCookieTokenFallback, extendTokenExpiry } from '@/lib/chat/public-widget-session'
import { publicSessionTokenSchema, uuidSchema, clinicSlugSchema, widgetAccessTokenSchema } from '@/lib/chat/widget-api-schemas'
import { verifyWidgetAccessToken } from '@/lib/widget/widget-access-token'
import { consumeDistributedRateLimit, widgetAppointmentKey } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    let query = supabase
      .from('appointment_requests')
      .select('*')
      .eq('clinic_id', current.clinic.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: appointmentRequests, error } = await query

    if (error) throw error

    return NextResponse.json(appointmentRequests)
  } catch (error) {
    console.error('Error fetching appointment requests:', error)
    return NextResponse.json({ error: 'Failed to fetch appointment requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clinicId,
      clinicSlug,
      widgetAccessToken,
      visitorId,
      name,
      phone,
      preferredDate,
      preferredTime,
      reason,
      preferredDoctor,
      source,
      conversationId,
      leadId,
      publicSessionToken,
    } = body

    if (!name || !phone || !preferredDate || !preferredTime) {
      return NextResponse.json(
        { error: 'name, phone, preferredDate, and preferredTime are required' },
        { status: 400 },
      )
    }

    // Validate public-session-related fields format before any DB interaction
    if (clinicId && !uuidSchema.safeParse(clinicId).success) {
      return NextResponse.json({ error: 'Invalid clinicId format' }, { status: 400 })
    }
    if (conversationId && !uuidSchema.safeParse(conversationId).success) {
      return NextResponse.json({ error: 'Invalid conversationId format' }, { status: 400 })
    }
    if (publicSessionToken && !publicSessionTokenSchema.safeParse(publicSessionToken).success) {
      return NextResponse.json({ error: 'Invalid session token format' }, { status: 400 })
    }
    if (leadId && !uuidSchema.safeParse(leadId).success) {
      return NextResponse.json({ error: 'Invalid leadId format' }, { status: 400 })
    }
    if (clinicSlug && !clinicSlugSchema.safeParse(clinicSlug).success) {
      return NextResponse.json({ error: 'Invalid clinicSlug format' }, { status: 400 })
    }
    if (widgetAccessToken && !widgetAccessTokenSchema.safeParse(widgetAccessToken).success) {
      return NextResponse.json({ error: 'Invalid widget access token format' }, { status: 400 })
    }

    const adminClient = createSupabaseAdminClient()

    // ── Resolve clinic - support slug-based public path ──────────
    let resolvedClinicId: string | null = clinicId || null
    let resolvedConversationId: string | null = null
    let isPublicPath = false
    let isWidgetSlugPath = false

    // Slug-based public path with widget access token
    if (!resolvedClinicId && clinicSlug) {
      if (!widgetAccessToken) {
        return NextResponse.json({ error: 'Widget access token is required for slug-based requests.' }, { status: 401 })
      }
      const verifiedToken = verifyWidgetAccessToken(widgetAccessToken)
      if (!verifiedToken || verifiedToken.slug !== clinicSlug) {
        return NextResponse.json({ error: 'Invalid or expired widget access token.' }, { status: 401 })
      }

      // Distributed rate limit appointment requests
      const effectiveVisitorId = visitorId || getClientIp(request.headers)
      const ip = getClientIp(request.headers)
      const apptPreset = widgetAppointmentKey(effectiveVisitorId, ip)
      const rateLimit = await consumeDistributedRateLimit(apptPreset.key, apptPreset.limit, apptPreset.windowMs)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: 'Too many appointment requests.' }, { status: 429 })
      }

      // Resolve clinic by slug
      const { data: slugClinic, error: slugError } = await adminClient
        .from('clinic_ai_profile_view')
        .select('clinic_id')
        .eq('slug', clinicSlug)
        .eq('status', 'active')
        .eq('is_live', true)
        .eq('widget_enabled', true)
        .maybeSingle()

      if (slugError || !slugClinic) {
        return NextResponse.json({ error: 'Clinic is unavailable' }, { status: 404 })
      }
      resolvedClinicId = slugClinic.clinic_id
      isPublicPath = true
      isWidgetSlugPath = true
    } else if (!resolvedClinicId) {
      // Admin path: resolve from auth
      const { user, supabase, error: authError } = await requireAuth()
      if (authError || !user || !supabase) {
        return NextResponse.json({ error: 'clinicId or authentication required' }, { status: 400 })
      }
      const current = await getCurrentClinic(supabase, user)
      if (!current.clinic) {
        return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
      }
      resolvedClinicId = current.clinic.id
    } else {
      // Legacy public clinicId path — no longer supported for unauthenticated access.
      // Public widget access now requires clinicSlug + widgetAccessToken.
      return NextResponse.json(
        { error: 'Public widget access requires clinicSlug. Please regenerate your embed code.' },
        { status: 400 },
      )
    }

    if (conversationId) {
      if (isPublicPath) {
        // Public: validate via explicit token first (primary), then cookie (fallback)
        let conversation: { id: string } | null = null

        if (publicSessionToken && resolvedClinicId) {
          const conv = await validatePublicSessionToken({
            conversationId: String(conversationId),
            publicSessionToken,
            expectedClinicId: resolvedClinicId,
          })
          if (conv) conversation = { id: conv.id }
        }

        if (!conversation) {
          const rawToken = (await cookies()).get(CHAT_SESSION_COOKIE)?.value
          if (rawToken && resolvedClinicId) {
            const cookieConv = await validateCookieTokenFallback({
              conversationId: String(conversationId),
              rawToken,
              expectedClinicId: resolvedClinicId,
            })
            if (cookieConv) conversation = { id: cookieConv.id }
          }
        }

        if (!conversation) {
          return NextResponse.json({ error: 'Session expired. Please start a new conversation.' }, { status: 401 })
        }

        resolvedConversationId = conversation.id
      } else {
        const { data: conversation } = await adminClient
          .from('conversations')
          .select('id')
          .eq('id', String(conversationId))
          .eq('clinic_id', resolvedClinicId)
          .maybeSingle()

        if (!conversation) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        resolvedConversationId = conversation.id
      }
    }

    let resolvedLeadId: string | null = null
    if (leadId) {
      const { data: lead } = await adminClient
        .from('leads')
        .select('id')
        .eq('id', String(leadId))
        .eq('clinic_id', resolvedClinicId)
        .maybeSingle()

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }

      resolvedLeadId = lead.id
    }

    const { data: appointmentRequest, error } = await adminClient
      .from('appointment_requests')
      .insert({
        clinic_id: resolvedClinicId,
        conversation_id: resolvedConversationId,
        lead_id: resolvedLeadId,
        name,
        phone,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        reason: reason || '',
        preferred_doctor: preferredDoctor || null,
        status: 'requested',
        source: source || 'chatbot',
      })
      .select('*')
      .single()

    if (error) throw error

    if (resolvedConversationId) {
      await adminClient
        .from('conversations')
        .update({
          appointment_requested: true,
          lead_captured: true,
          visitor_name: String(name),
        })
        .eq('id', resolvedConversationId)

      // Extend token expiry on valid public activity
      if (isPublicPath) {
        await extendTokenExpiry(resolvedConversationId)
      }
    }

    return NextResponse.json(appointmentRequest, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment request:', error)
    return NextResponse.json({ error: 'Failed to create appointment request' }, { status: 500 })
  }
}
