import { clinicData, getDefaultClinic, getDefaultWidgetSettings } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

const editableFields = [
  'botName',
  'welcomeMessage',
  'tooltipText',
  'showTooltip',
  'inputPlaceholder',
  'primaryColor',
  'textOnPrimary',
  'widgetPosition',
  'widgetSize',
  'autoOpenDelay',
  'ctaText',
  'ctaLink',
] as const

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

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configuredOrigin) {
    return configuredOrigin.endsWith('/') ? configuredOrigin.slice(0, -1) : configuredOrigin
  }

  return 'https://yourdomain.com'
}

export async function GET(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    const widgetSettings = await getDefaultWidgetSettings()

    if (!clinic || !widgetSettings) {
      return NextResponse.json({ error: 'Widget settings not found' }, { status: 404 })
    }

    const origin = resolveScriptOrigin(request)
    const embedCode = `<script src="${origin}/widget.js" data-clinic-id="${clinic.id}"></script>`

    return NextResponse.json({
      ...widgetSettings,
      clinicId: clinic.id,
      embedCode,
    })
  } catch (error) {
    console.error('Error fetching widget settings:', error)
    return NextResponse.json({ error: 'Failed to fetch widget settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const widgetSettings = await getDefaultWidgetSettings()
    if (!widgetSettings) {
      return NextResponse.json({ error: 'Widget settings not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    const updated = await clinicData.widgetSetting.update({
      where: { id: widgetSettings.id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating widget settings:', error)
    return NextResponse.json({ error: 'Failed to update widget settings' }, { status: 500 })
  }
}
