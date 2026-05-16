import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { CHAT_SESSION_COOKIE } from '@/lib/chat/session'
import { validatePublicSessionToken, validateCookieTokenFallback, extendTokenExpiry } from '@/lib/chat/public-widget-session'
import { analyticsEventSchema } from '@/lib/chat/widget-api-schemas'
import { verifyWidgetAccessToken } from '@/lib/widget/widget-access-token'
import { checkWidgetRateLimit, widgetEventsRateKey } from '@/lib/widget/widget-rate-limit'
import { getClientIp } from '@/lib/security'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request shape with Zod
    const parsed = analyticsEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      )
    }
    const { eventType, source, conversationId, clinicId: bodyClinicId, clinicSlug, publicSessionToken, widgetAccessToken, visitorId, service, metadata } = parsed.data

    // Resolve clinic_id: try auth first, then body (for widget), then from conversation
    let clinicId: string | null = null
    let slugResolvedClinicId: string | null = null

    // ── Widget-sourced events: REQUIRE token (Finding 1) ──────────
    // All widget events must carry clinicSlug + widgetAccessToken.
    // The old path of trusting bodyClinicId or resolving slug without
    // a token is removed — it was an unauthenticated injection vector.
    if (source === 'widget') {
      if (!clinicSlug || !widgetAccessToken) {
        return NextResponse.json(
          { error: 'Widget events require clinicSlug and widgetAccessToken.' },
          { status: 401 },
        )
      }

      const verifiedToken = verifyWidgetAccessToken(widgetAccessToken)
      if (!verifiedToken || verifiedToken.slug !== clinicSlug) {
        return NextResponse.json({ error: 'Invalid or expired widget access token.' }, { status: 401 })
      }

      // Rate limit by visitorId for widget events
      const effectiveVisitorId = visitorId || getClientIp(request.headers)
      const rateLimit = checkWidgetRateLimit(widgetEventsRateKey(effectiveVisitorId))
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: 'Too many events.' }, { status: 429 })
      }

      // Resolve clinic by slug (token already verified)
      const adminClientForSlug = createSupabaseAdminClient()
      const { data: slugClinic } = await adminClientForSlug
        .from('clinic_ai_profile_view')
        .select('clinic_id')
        .eq('slug', clinicSlug)
        .eq('status', 'active')
        .eq('is_live', true)
        .eq('widget_enabled', true)
        .maybeSingle()

      if (slugClinic) {
        slugResolvedClinicId = slugClinic.clinic_id
      }
    }

    // Try authenticated path (for non-widget / playground source)
    const { user, supabase } = await requireAuth()
    if (user && supabase) {
      const { getCurrentClinic } = await import('@/lib/clinics/current')
      const current = await getCurrentClinic(supabase, user)
      if (current.clinic) {
        clinicId = current.clinic.id
      }
    }

    // Use slug-resolved clinic ID if available
    if (!clinicId && slugResolvedClinicId) {
      clinicId = slugResolvedClinicId
    }

    let resolvedConversationId: string | null = null

    if (conversationId) {
      if (source === 'widget') {
        // Widget source: require token validation (explicit token primary, cookie fallback)
        const adminClient = createSupabaseAdminClient()
        let conv: { id: string; clinic_id: string } | null = null

        if (publicSessionToken && clinicId) {
          // First try: explicit token from host-page session handoff
          const validated = await validatePublicSessionToken({
            conversationId,
            publicSessionToken,
            expectedClinicId: clinicId,
          })
          if (validated) conv = { id: validated.id, clinic_id: validated.clinic_id }
        }

        if (!conv) {
          // Fallback: cookie-based token (with expiry enforcement)
          const rawToken = (await cookies()).get(CHAT_SESSION_COOKIE)?.value
          if (rawToken && clinicId) {
            const cookieConv = await validateCookieTokenFallback({
              conversationId,
              rawToken,
              expectedClinicId: clinicId,
            })
            if (cookieConv) conv = { id: cookieConv.id, clinic_id: cookieConv.clinic_id }
          }
        }

        if (!conv) {
          return NextResponse.json({ error: 'Session expired. Please start a new conversation.' }, { status: 401 })
        }

        if (clinicId && conv.clinic_id !== clinicId) {
          return NextResponse.json({ error: 'Conversation does not belong to this clinic' }, { status: 404 })
        }

        clinicId = conv.clinic_id
        resolvedConversationId = conv.id
      } else {
        // Non-widget source: existing logic (no token check needed)
        const adminClient = createSupabaseAdminClient()
        const { data: conv } = await adminClient
          .from('conversations')
          .select('id, clinic_id')
          .eq('id', conversationId)
          .maybeSingle()

        if (!conv) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        if (clinicId && conv.clinic_id !== clinicId) {
          return NextResponse.json({ error: 'Conversation does not belong to this clinic' }, { status: 404 })
        }

        clinicId = conv.clinic_id
        resolvedConversationId = conv.id
      }
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'Cannot resolve clinic context' }, { status: 400 })
    }

    // For widget-sourced events without a conversation, verify the clinic
    // is live and widget-enabled to prevent cross-clinic analytics spoofing
    if (source === 'widget' && !resolvedConversationId) {
      const adminClient = createSupabaseAdminClient()
      const { data: clinic } = await adminClient
        .from('clinic_ai_profile_view')
        .select('clinic_id')
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .eq('is_live', true)
        .eq('widget_enabled', true)
        .maybeSingle()
      if (!clinic) {
        return NextResponse.json({ error: 'Clinic is unavailable' }, { status: 404 })
      }
    }

    const adminClient = createSupabaseAdminClient()
    const { data: created, error } = await adminClient
      .from('interaction_events')
      .insert({
        clinic_id: clinicId,
        conversation_id: resolvedConversationId,
        event_type: eventType,
        source: source,
        service: service || null,
        metadata: {
          ...(metadata || {}),
          // Store request context for widget events
          ...(source === 'widget' ? {
            origin: request.headers.get('origin') || null,
            userAgent: request.headers.get('user-agent') || null,
            visitorId: visitorId || null,
          } : {}),
        },
      })
      .select('*')
      .single()

    if (error) throw error

    // Extend token expiry on valid widget activity
    if (resolvedConversationId && source === 'widget') {
      await extendTokenExpiry(resolvedConversationId)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error logging analytics event:', error)
    return NextResponse.json({ error: 'Failed to log analytics event' }, { status: 500 })
  }
}
