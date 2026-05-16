import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'

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
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const body = await request.json()
    const templateId = String(body.templateId || '')
    const selected = templates[templateId as keyof typeof templates]
    if (!selected) {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('widget_settings')
      .update({
        primary_color: selected.primaryColor,
        welcome_message: selected.welcomeMessage,
      })
      .eq('clinic_id', clinic.id)
      .select('id,clinic_id,enabled,widget_title,welcome_message,primary_color,position,show_whatsapp_button,show_call_button,show_location_button,allowed_domains')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to apply widget template' }, { status: 400 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error applying widget template:', error)
    return NextResponse.json({ error: 'Failed to apply widget template' }, { status: 500 })
  }
}
