import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
    const search = searchParams.get('search')

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('clinic_id', current.clinic.id)
      .order('updated_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,channel.ilike.%${search}%,visitor_id.ilike.%${search}%`)
    }

    const { data: conversations, error } = await query

    if (error) throw error

    // Get event counts for all conversations
    const adminClient = createSupabaseAdminClient()
    const convIds = (conversations ?? []).map((c: { id: string }) => c.id)

    let eventCountsByConversation: Record<string, { whatsapp: number; location: number; directions: number; call: number }> = {}

    if (convIds.length > 0) {
      const { data: events } = await adminClient
        .from('interaction_events')
        .select('conversation_id, event_type')
        .in('conversation_id', convIds)

      eventCountsByConversation = (events ?? []).reduce<Record<string, { whatsapp: number; location: number; directions: number; call: number }>>((acc, event) => {
        if (!event.conversation_id) return acc
        if (!acc[event.conversation_id]) {
          acc[event.conversation_id] = { whatsapp: 0, location: 0, directions: 0, call: 0 }
        }
        if (event.event_type === 'whatsapp_click') acc[event.conversation_id].whatsapp += 1
        if (event.event_type === 'location_click') acc[event.conversation_id].location += 1
        if (event.event_type === 'directions_click') acc[event.conversation_id].directions += 1
        if (event.event_type === 'call_click') acc[event.conversation_id].call += 1
        return acc
      }, {})
    }

    const flattened = (conversations ?? []).map((conv: Record<string, unknown>) => {
      const counts = eventCountsByConversation[conv.id as string] || { whatsapp: 0, location: 0, directions: 0, call: 0 }
      return {
        id: conv.id,
        patientId: null,
        patientName: (conv as Record<string, unknown>).visitor_name || 'Website Visitor',
        channel: conv.channel,
        status: conv.status,
        subject: conv.subject,
        messageCount: conv.message_count,
        lastMessage: conv.last_message,
        sourcePage: conv.source_page,
        helpfulStatus: conv.helpful_status,
        needsImprovement: conv.needs_improvement,
        leadCaptured: conv.lead_captured,
        appointmentRequested: conv.appointment_requested,
        whatsappClicks: counts.whatsapp,
        locationClicks: counts.location,
        directionsClicks: counts.directions,
        callClicks: counts.call,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      }
    })

    return NextResponse.json(flattened)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const body = await request.json()
    const { subject, channel } = body

    const adminClient = createSupabaseAdminClient()

    const { data: conversation, error } = await adminClient
      .from('conversations')
      .insert({
        clinic_id: current.clinic.id,
        channel: channel || 'web',
        subject: subject || null,
        status: 'active',
        source_page: '/',
        helpful_status: 'unreviewed',
        needs_improvement: false,
        lead_captured: false,
        appointment_requested: false,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      id: conversation.id,
      patientId: null,
      patientName: 'Website Visitor',
      channel: conversation.channel,
      status: conversation.status,
      subject: conversation.subject,
      messageCount: conversation.message_count,
      lastMessage: conversation.last_message,
      sourcePage: conversation.source_page,
      helpfulStatus: conversation.helpful_status,
      needsImprovement: conversation.needs_improvement,
      leadCaptured: conversation.lead_captured,
      appointmentRequested: conversation.appointment_requested,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}
