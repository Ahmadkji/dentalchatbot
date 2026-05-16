import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { mintWidgetAccessToken } from '@/lib/widget/widget-access-token'
import { getClientIp } from '@/lib/security'
import { checkWidgetRateLimit, widgetConfigRateKey } from '@/lib/widget/widget-rate-limit'
import { isOriginAllowed } from '@/lib/clinics/validation'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const slug = searchParams.get('slug')?.trim() || ''

    // Validate slug format
    if (!slug || !SLUG_PATTERN.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid or missing slug parameter.' },
        { status: 400 },
      )
    }

    // Rate limit by IP
    const ip = getClientIp(request.headers)
    const rateLimit = checkWidgetRateLimit(widgetConfigRateKey(ip))
    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429 },
      )
      response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
      return response
    }

    // Validate browser Origin header
    const origin = request.headers.get('origin')?.trim() || ''
    if (!origin) {
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
      return NextResponse.json(
        { error: 'Clinic not found.' },
        { status: 404 },
      )
    }

    // Check clinic status
    if (clinic.status !== 'active' || !clinic.is_live || !clinic.widget_enabled) {
      return NextResponse.json(
        { error: 'Widget is not available for this clinic.' },
        { status: 404 },
      )
    }

    // Enforce allowed domains
    const allowedDomains: string[] = clinic.allowed_domains || []
    if (!isOriginAllowed(origin, allowedDomains)) {
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

      // Widget access token (short-lived, signed)
      widgetAccessToken,
    }

    // Set CORS headers for cross-origin bootstrap request
    const response = NextResponse.json(config)
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET')
    response.headers.set('Access-Control-Max-Age', '300')
    response.headers.set('Vary', 'Origin')
    return response
  } catch (error) {
    console.error('Error in widget config route:', error)
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

  // If origin or slug is missing, reject without echoing CORS headers
  if (!origin || !slug || !SLUG_PATTERN.test(slug)) {
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
      return new NextResponse(null, { status: 403 })
    }
  } catch {
    return new NextResponse(null, { status: 500 })
  }

  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Max-Age', '300')
  response.headers.set('Vary', 'Origin')
  return response
}
