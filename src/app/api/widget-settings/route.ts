import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { requireCurrentClinicAccess } from '@/lib/clinic-access'
import { normalizeAllowedDomains } from '@/lib/clinics/validation'
import { getSiteUrl } from '@/lib/site-url'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const VALID_POSITIONS = ['bottom-right', 'bottom-left'] as const

const widgetSettingsPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    botName: z.string().trim().min(1).max(80).optional(),
    welcomeMessage: z.string().trim().min(1).max(500).optional(),
    primaryColor: z.string().regex(HEX_COLOR_RE).optional(),
    widgetPosition: z.enum(VALID_POSITIONS).optional(),
    allowedDomains: z.array(z.string().trim().max(255)).max(25).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable field is required.',
  })

interface WidgetSettingsRow {
  id: string
  clinic_id: string
  enabled: boolean
  widget_title: string
  welcome_message: string
  primary_color: string
  position: 'bottom-right' | 'bottom-left'
  show_whatsapp_button: boolean
  show_call_button: boolean
  show_location_button: boolean
  allowed_domains: string[]
}

function resolveScriptOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')

  if (forwardedHost) {
    if (forwardedProto) {
      return `${forwardedProto}://${forwardedHost}`
    }
    if (forwardedHost.includes('localhost') || forwardedHost.startsWith('127.0.0.1')) {
      return `http://${forwardedHost}`
    }
    return `https://${forwardedHost}`
  }

  return getSiteUrl()
}

function mapWidgetSettings(row: WidgetSettingsRow, clinic: { id: string; slug: string; whatsapp: string | null }, embedCode?: string) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    slug: clinic.slug,
    enabled: row.enabled,
    botName: row.widget_title,
    welcomeMessage: row.welcome_message,
    primaryColor: row.primary_color,
    widgetPosition: row.position,
    showWhatsappButton: row.show_whatsapp_button,
    showCallButton: row.show_call_button,
    showLocationButton: row.show_location_button,
    allowedDomains: row.allowed_domains,
    embedCode,
  }
}

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data: widgetSettings, error } = await supabase
      .from('widget_settings')
      .select('id,clinic_id,enabled,widget_title,welcome_message,primary_color,position,show_whatsapp_button,show_call_button,show_location_button,allowed_domains')
      .eq('clinic_id', clinic.id)
      .maybeSingle()

    if (error || !widgetSettings) {
      console.warn('[widget-settings:GET] Widget settings not found', {
        userId: user.id,
        clinicId: clinic.id,
        clinicSlug: clinic.slug,
      })
      return NextResponse.json({ error: 'Widget settings not found' }, { status: 404 })
    }

    const origin = resolveScriptOrigin(request)
    const embedCode = `<script src="${origin}/widget.js" data-clinic-slug="${clinic.slug}"></script>`
    console.info('[widget-settings:GET] Generated widget embed code', {
      userId: user.id,
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      origin,
      allowedDomainsCount: widgetSettings.allowed_domains.length,
    })

    return NextResponse.json(mapWidgetSettings(widgetSettings as WidgetSettingsRow, clinic, embedCode))
  } catch (error) {
    console.error('[widget-settings:GET] Failed to fetch widget settings', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch widget settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const access = await requireCurrentClinicAccess(supabase, user, ['owner', 'admin'])
    if (access.error) return access.error

    const { clinic } = access.current
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const body = await request.json().catch(() => null)
    const parsed = widgetSettingsPatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid widget settings payload.' },
        { status: 400 },
      )
    }

    const data: Record<string, unknown> = parsed.data

    const updateData: Record<string, unknown> = {}
    if (data.enabled !== undefined) updateData.enabled = data.enabled
    if (typeof data.botName === 'string') updateData.widget_title = data.botName
    if (typeof data.welcomeMessage === 'string') updateData.welcome_message = data.welcomeMessage
    if (data.primaryColor !== undefined) updateData.primary_color = data.primaryColor
    if (data.widgetPosition !== undefined) updateData.position = data.widgetPosition
    if (Array.isArray(data.allowedDomains)) {
      const normalized = normalizeAllowedDomains(data.allowedDomains as string[])
      updateData.allowed_domains = normalized
    }

    const { data: updated, error } = await supabase
      .from('widget_settings')
      .update(updateData)
      .eq('clinic_id', clinic.id)
      .select('id,clinic_id,enabled,widget_title,welcome_message,primary_color,position,show_whatsapp_button,show_call_button,show_location_button,allowed_domains')
      .single()

    if (error) {
      console.error('[widget-settings:PATCH] Failed to update widget settings', {
        userId: user.id,
        clinicId: clinic.id,
        clinicSlug: clinic.slug,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Failed to update widget settings' }, { status: 400 })
    }

    console.info('[widget-settings:PATCH] Updated widget settings', {
      userId: user.id,
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      updatedFields: Object.keys(updateData),
    })
    return NextResponse.json(mapWidgetSettings(updated as WidgetSettingsRow, clinic))
  } catch (error) {
    console.error('[widget-settings:PATCH] Failed to update widget settings', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to update widget settings' }, { status: 500 })
  }
}
