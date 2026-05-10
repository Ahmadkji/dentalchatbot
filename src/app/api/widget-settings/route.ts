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

export async function GET() {
  try {
    const clinic = await getDefaultClinic()
    const widgetSettings = await getDefaultWidgetSettings()

    if (!clinic || !widgetSettings) {
      return NextResponse.json({ error: 'Widget settings not found' }, { status: 404 })
    }

    const embedCode = `<script src="https://yourdomain.com/widget.js" data-clinic-id="${clinic.id}"></script>`

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
