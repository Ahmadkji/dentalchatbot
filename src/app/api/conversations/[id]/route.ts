import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { id } = await params
    const adminClient = createSupabaseAdminClient()

    // Verify conversation belongs to this clinic
    const { data: conversation, error: convError } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (convError) throw convError
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Get messages
    const { data: convMessages, error: msgError } = await adminClient
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    // Get event counts
    const { data: events } = await adminClient
      .from('interaction_events')
      .select('event_type')
      .eq('conversation_id', id)

    const counts = (events ?? []).reduce(
      (acc: { whatsapp: number; location: number; directions: number; call: number }, event: { event_type: string }) => {
        if (event.event_type === 'whatsapp_click') acc.whatsapp += 1
        if (event.event_type === 'location_click') acc.location += 1
        if (event.event_type === 'directions_click') acc.directions += 1
        if (event.event_type === 'call_click') acc.call += 1
        return acc
      },
      { whatsapp: 0, location: 0, directions: 0, call: 0 },
    )

    return NextResponse.json({
      id: conversation.id,
      patientId: null,
      patientName: conversation.visitor_name || 'Website Visitor',
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
      whatsappClicks: counts.whatsapp,
      locationClicks: counts.location,
      directionsClicks: counts.directions,
      callClicks: counts.call,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages: (convMessages ?? []).map((m: Record<string, unknown>) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, helpfulStatus, needsImprovement, leadCaptured, appointmentRequested, sourcePage } = body

    if (
      status === undefined &&
      helpfulStatus === undefined &&
      needsImprovement === undefined &&
      leadCaptured === undefined &&
      appointmentRequested === undefined &&
      sourcePage === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one update field is required' },
        { status: 400 },
      )
    }

    const adminClient = createSupabaseAdminClient()

    // Verify conversation belongs to this clinic
    const { data: existing, error: findError } = await adminClient
      .from('conversations')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (helpfulStatus !== undefined) updateData.helpful_status = helpfulStatus
    if (needsImprovement !== undefined) updateData.needs_improvement = needsImprovement
    if (leadCaptured !== undefined) updateData.lead_captured = leadCaptured
    if (appointmentRequested !== undefined) updateData.appointment_requested = appointmentRequested
    if (sourcePage !== undefined) updateData.source_page = sourcePage

    const { data: conversation, error } = await adminClient
      .from('conversations')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    // Get event counts for response
    const { data: events } = await adminClient
      .from('interaction_events')
      .select('event_type')
      .eq('conversation_id', id)

    const counts = (events ?? []).reduce(
      (acc: { whatsapp: number; location: number; directions: number; call: number }, event: { event_type: string }) => {
        if (event.event_type === 'whatsapp_click') acc.whatsapp += 1
        if (event.event_type === 'location_click') acc.location += 1
        if (event.event_type === 'directions_click') acc.directions += 1
        if (event.event_type === 'call_click') acc.call += 1
        return acc
      },
      { whatsapp: 0, location: 0, directions: 0, call: 0 },
    )

    return NextResponse.json({
      id: conversation.id,
      patientId: null,
      patientName: conversation.visitor_name || 'Website Visitor',
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
      whatsappClicks: counts.whatsapp,
      locationClicks: counts.location,
      directionsClicks: counts.directions,
      callClicks: counts.call,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}
