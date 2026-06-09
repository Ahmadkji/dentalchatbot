import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { mintWidgetAccessToken } from '@/lib/widget/widget-access-token'
import { getClientIp } from '@/lib/security'
import { consumeDistributedRateLimit, widgetConfigKey } from '@/lib/rate-limit'
import { isOriginAllowed } from '@/lib/clinics/validation'
import { getClinicBillingStatus } from '@/lib/billing/lemonsqueezy-server'
import { buildLeadGatePayload } from '@/lib/chat/lead-gate'
import { getLeadGateSettings } from '@/lib/leads/lead-gate-settings'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function logWidgetConfig(level: 'info' | 'warn' | 'error', message: string, details: Record<string, unknown>) {
  if (level === 'error') {
    console.error(`[widget:config] ${message}`, details)
    return
  }

  if (level === 'warn') {
    console.warn(`[widget:config] ${message}`, details)
    return
  }

  console.info(`[widget:config] ${message}`, details)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const slug = searchParams.get('slug')?.trim() || ''
    const origin = request.headers.get('origin')?.trim() || ''
    const ip = getClientIp(request.headers)
    const requestContext = { slug, origin, ip }

    logWidgetConfig('info', 'Widget bootstrap request received.', requestContext)

    // Validate slug format
    if (!slug || !SLUG_PATTERN.test(slug)) {
      logWidgetConfig('warn', 'Rejected widget request with an invalid or missing slug.', requestContext)
      return NextResponse.json(
        { error: 'Invalid or missing slug parameter.' },
        { status: 400 },
      )
    }

    // Distributed rate limit by IP
    const preset = widgetConfigKey(ip)
    const rateLimit = await consumeDistributedRateLimit(preset.key, preset.limit, preset.windowMs)
    if (!rateLimit.allowed) {
      logWidgetConfig('warn', 'Widget config request rate-limited.', {
        ...requestContext,
        resetAt: rateLimit.resetAt,
      })
      const response = NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429 },
      )
      response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
      return response
    }

    // Validate browser Origin header
    if (!origin) {
      logWidgetConfig('warn', 'Rejected widget request with a missing Origin header.', requestContext)
      return NextResponse.json(
        { error: 'Origin header is required.' },
        { status: 400 },
      )
    }

    // Look up clinic by slug — must be active, live, and widget-enabled
    const adminClient = createSupabaseAdminClient()
    const { data: clinic, error: clinicError } = await adminClient
      .from('clinic_ai_profile_view')
      .select(
        'clinic_id, name, slug, city, timezone, widget_enabled, status, is_live, allowed_domains, widget_title, welcome_message, primary_color, show_whatsapp_button, show_call_button, show_location_button, whatsapp, phone, map_link, website_url, widget_position',
      )
      .eq('slug', slug)
      .maybeSingle()

    if (clinicError || !clinic) {
      logWidgetConfig('warn', 'Widget bootstrap clinic lookup failed.', requestContext)
      return NextResponse.json(
        { error: 'Clinic not found.' },
        { status: 404 },
      )
    }

    // Check clinic status
    if (clinic.status !== 'active' || !clinic.is_live || !clinic.widget_enabled) {
      logWidgetConfig('warn', 'Widget blocked because the clinic is not live or not widget-enabled.', {
        ...requestContext,
        clinicStatus: clinic.status,
        isLive: clinic.is_live,
        widgetEnabled: clinic.widget_enabled,
      })
      return NextResponse.json(
        { error: 'Widget is not available for this clinic.' },
        { status: 404 },
      )
    }

    // Enforce allowed domains
    const allowedDomains: string[] = clinic.allowed_domains || []
    if (!isOriginAllowed(origin, allowedDomains)) {
      logWidgetConfig('warn', 'Widget blocked because the origin is not in allowed_domains.', {
        ...requestContext,
        allowedDomainsCount: allowedDomains.length,
      })
      return NextResponse.json(
        { error: 'This website is not authorized to embed this widget.' },
        { status: 403 },
      )
    }

    // Fetch active quick prompts for this clinic
    const { data: prompts } = await adminClient
      .from('quick_prompts')
      .select('label, intent, sort_order')
      .eq('clinic_id', clinic.clinic_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const billing = await getClinicBillingStatus(clinic.clinic_id)
    const { data: leadSettingRows } = await adminClient
      .from('clinic_settings')
      .select('key,value')
      .eq('clinic_id', clinic.clinic_id)
      .in('key', ['lead_collection_enabled', 'lead_required_fields'])

    const leadGateSettings = getLeadGateSettings(leadSettingRows ?? [])

    logWidgetConfig('info', 'Widget quick prompts loaded.', {
      ...requestContext,
      promptCount: prompts?.length || 0,
    })

    // Mint a short-lived widget access token
    const widgetAccessToken = mintWidgetAccessToken(slug, origin)

    // Build safe public config response — no internal IDs or private data
    const config = {
      // Clinic public info
      clinicName: clinic.name,
      slug: clinic.slug,
      city: clinic.city,
      timezone: clinic.timezone,

      // Widget appearance
      widgetTitle: clinic.widget_title || clinic.name,
      welcomeMessage: clinic.welcome_message || 'Hi! How can I help you today?',
      primaryColor: clinic.primary_color || '#059669',
      widgetPosition: clinic.widget_position || 'bottom-right',
      showWhatsappButton: clinic.show_whatsapp_button,
      showCallButton: clinic.show_call_button,
      showLocationButton: clinic.show_location_button,

      // Public action links
      whatsappLink: clinic.whatsapp
        ? `https://wa.me/${clinic.whatsapp.replace(/^\+/, '')}`
        : null,
      phoneLink: clinic.phone || null,
      mapsLink: clinic.map_link || null,

      // Active quick prompts (label + intent only)
      quickPrompts: (prompts || []).map((p) => ({
        label: p.label,
        intent: p.intent,
      })),

      // Lead gate
      leadGateRequired: billing.features.canCaptureLeads && leadGateSettings.collectionEnabled,
      leadGate: buildLeadGatePayload({
        fields: leadGateSettings.requiredFields,
        prompt: leadGateSettings.prompt,
      }),

      // Widget access token (short-lived, signed)
      widgetAccessToken,
    }

    // Set CORS headers for cross-origin bootstrap request
    const response = NextResponse.json(config)
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET')
    response.headers.set('Access-Control-Max-Age', '300')
    response.headers.set('Vary', 'Origin')
    logWidgetConfig('info', 'Widget config response sent successfully.', {
      ...requestContext,
      promptCount: prompts?.length || 0,
      clinicStatus: clinic.status,
      isLive: clinic.is_live,
      widgetEnabled: clinic.widget_enabled,
    })
    return response
  } catch (error) {
    logWidgetConfig('error', 'Error in widget config route.', {
      slug: request.nextUrl.searchParams.get('slug')?.trim() || '',
      origin: request.headers.get('origin')?.trim() || '',
      ip: getClientIp(request.headers),
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to load widget configuration.' },
      { status: 500 },
    )
  }
}

// Handle CORS preflight for the config bootstrap route.
// Validates origin against clinic allowed_domains before echoing CORS headers,
// preventing arbitrary sites from discovering the endpoint's CORS policy.
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')?.trim() || ''
  const { searchParams } = request.nextUrl
  const slug = searchParams.get('slug')?.trim() || ''
  const ip = getClientIp(request.headers)
  const requestContext = { slug, origin, ip }

  logWidgetConfig('info', 'Widget CORS preflight received.', requestContext)

  // If origin or slug is missing, reject without echoing CORS headers
  if (!origin || !slug || !SLUG_PATTERN.test(slug)) {
    logWidgetConfig('warn', 'Rejected widget CORS preflight with missing origin or invalid slug.', requestContext)
    return new NextResponse(null, { status: 403 })
  }

  // Look up clinic and validate origin against allowed_domains
  try {
    const adminClient = createSupabaseAdminClient()
    const { data: clinic } = await adminClient
      .from('clinic_ai_profile_view')
      .select('allowed_domains')
      .eq('slug', slug)
      .eq('status', 'active')
      .eq('is_live', true)
      .eq('widget_enabled', true)
      .maybeSingle()

    const allowedDomains: string[] = clinic?.allowed_domains || []
    if (!clinic || !isOriginAllowed(origin, allowedDomains)) {
      logWidgetConfig('warn', 'Widget CORS preflight rejected because the origin is not allowed.', {
        ...requestContext,
        allowedDomainsCount: allowedDomains.length,
      })
      return new NextResponse(null, { status: 403 })
    }
  } catch (optionsError) {
    logWidgetConfig('error', 'Failed to validate CORS preflight.', {
      ...requestContext,
      error: optionsError instanceof Error ? optionsError.message : String(optionsError),
    })
    return new NextResponse(null, { status: 500 })
  }

  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Max-Age', '300')
  response.headers.set('Vary', 'Origin')
  logWidgetConfig('info', 'Widget CORS preflight approved.', requestContext)
  return response
}
