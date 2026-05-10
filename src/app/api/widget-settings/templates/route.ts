import { clinicData, getDefaultWidgetSettings } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

const templates = {
  clean_dental_blue: {
    label: 'Clean Dental Blue',
    primaryColor: '#0a66c2',
    textOnPrimary: '#ffffff',
    widgetSize: 'comfortable',
    tooltipText: 'Need help with dental treatment information?',
    welcomeMessage: 'Hi, I can help with appointments, services, and clinic details.',
  },
  premium_white_clinic: {
    label: 'Premium White Clinic',
    primaryColor: '#0f766e',
    textOnPrimary: '#ffffff',
    widgetSize: 'comfortable',
    tooltipText: 'Ask us about premium smile care',
    welcomeMessage: 'Welcome to our premium dental clinic. How may we assist you today?',
  },
  kids_dental_friendly: {
    label: 'Kids Dental Friendly',
    primaryColor: '#0891b2',
    textOnPrimary: '#ffffff',
    widgetSize: 'large',
    tooltipText: 'Questions about kids dental visits?',
    welcomeMessage: 'Hi there! We are here to make dental visits easy for kids and parents.',
  },
  luxury_cosmetic_dental: {
    label: 'Luxury Cosmetic Dental',
    primaryColor: '#1d4ed8',
    textOnPrimary: '#ffffff',
    widgetSize: 'comfortable',
    tooltipText: 'Explore smile design and cosmetic options',
    welcomeMessage: 'Welcome. Ask us about whitening, aligners, veneers, and smile makeovers.',
  },
  dark_professional: {
    label: 'Dark Professional',
    primaryColor: '#111827',
    textOnPrimary: '#ffffff',
    widgetSize: 'compact',
    tooltipText: 'Need quick dental support?',
    welcomeMessage: 'Hello. This is your dental support assistant. How can I help?',
  },
} as const

export async function GET() {
  return NextResponse.json({
    templates: Object.entries(templates).map(([id, value]) => ({
      id,
      ...value,
    })),
  })
}

export async function POST(request: NextRequest) {
  try {
    const widgetSettings = await getDefaultWidgetSettings()
    if (!widgetSettings) {
      return NextResponse.json({ error: 'Widget settings not found' }, { status: 404 })
    }

    const body = await request.json()
    const templateId = String(body.templateId || '')
    const selected = templates[templateId as keyof typeof templates]
    if (!selected) {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
    }

    const updated = await clinicData.widgetSetting.update({
      where: { id: widgetSettings.id },
      data: {
        primaryColor: selected.primaryColor,
        textOnPrimary: selected.textOnPrimary,
        widgetSize: selected.widgetSize,
        tooltipText: selected.tooltipText,
        welcomeMessage: selected.welcomeMessage,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error applying widget template:', error)
    return NextResponse.json({ error: 'Failed to apply widget template' }, { status: 500 })
  }
}
