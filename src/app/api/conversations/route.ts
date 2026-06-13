import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const statusFilterSchema = z.enum(['active', 'pending', 'closed'])

function sanitizeSearchTerm(raw: string) {
  return raw
    .replace(/[,:().]/g, ' ')
    .replace(/[%_*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

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

    const rawLimit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)
    const rawCursor = searchParams.get('cursor') // updated_at cursor for keyset pagination

    let query = supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .eq('clinic_id', current.clinic.id)
      .order('updated_at', { ascending: false })
      .limit(rawLimit)

    const rawStatus = searchParams.get('status')
    if (rawStatus !== null) {
      const parsedStatus = statusFilterSchema.safeParse(rawStatus)
      if (!parsedStatus.success) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
      query = query.eq('status', parsedStatus.data)
    }

    if (rawCursor) {
      query = query.lt('updated_at', rawCursor)
    }

    const rawSearch = searchParams.get('search')
    if (rawSearch) {
      const safeSearch = sanitizeSearchTerm(rawSearch)
      if (safeSearch) {
        query = query.or(`subject.ilike.*${safeSearch}*,channel.ilike.*${safeSearch}*,visitor_id.ilike.*${safeSearch}*`)
      }
    }

    const { data: conversations, error, count } = await query

    if (error) throw error

    // Get event counts for all conversations
    const adminClient = createSupabaseAdminClient()
    const convIds = (conversations ?? []).map((c: { id: string }) => c.id)

    let eventCountsByConversation: Record<string, { whatsapp: number; location: number; directions: number; call: number }> = {}
    let handoffsByConversation: Record<
      string,
      {
        status: string | null
        trigger_source: string | null
        attempt_count: number
        last_error: string | null
        provider_accepted_at: string | null
        provider_delivered_at: string | null
      }
    > = {}

    if (convIds.length > 0) {
      const [{ data: events }, { data: handoffs, error: handoffError }] = await Promise.all([
        adminClient
          .from('interaction_events')
          .select('conversation_id, event_type')
          .in('conversation_id', convIds),
        adminClient
          .from('human_handoff_requests')
          .select(
            'conversation_id,status,trigger_source,attempt_count,last_error,provider_accepted_at,provider_delivered_at,sent_at',
          )
          .in('conversation_id', convIds),
      ])

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

      if (handoffError) {
        console.error('[conversations:GET] Failed to fetch human handoff rows', {
          userId: user.id,
          clinicId: current.clinic.id,
          error: handoffError.message,
        })
        throw handoffError
      }

      handoffsByConversation = (handoffs ?? []).reduce<
        Record<
          string,
          {
            status: string | null
            trigger_source: string | null
            attempt_count: number
            last_error: string | null
            provider_accepted_at: string | null
            provider_delivered_at: string | null
          }
        >
      >((acc, handoff) => {
        const conversationId = handoff.conversation_id as string | null
        if (!conversationId) return acc
        acc[conversationId] = {
          status: (handoff.status as string | null) ?? null,
          trigger_source: (handoff.trigger_source as string | null) ?? null,
          attempt_count: Number(handoff.attempt_count ?? 0),
          last_error: (handoff.last_error as string | null) ?? null,
          provider_accepted_at:
            (handoff.provider_accepted_at as string | null) ?? (handoff.sent_at as string | null) ?? null,
          provider_delivered_at: (handoff.provider_delivered_at as string | null) ?? null,
        }
        return acc
      }, {})
    }

    const flattened = (conversations ?? []).map((conv: Record<string, unknown>) => {
      const counts = eventCountsByConversation[conv.id as string] || { whatsapp: 0, location: 0, directions: 0, call: 0 }
      const handoff = handoffsByConversation[conv.id as string]
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
        humanHandoffStatus: handoff?.status ?? null,
        humanHandoffTriggerSource: handoff?.trigger_source ?? null,
        humanHandoffAttemptCount: handoff?.attempt_count ?? 0,
        humanHandoffLastError: handoff?.last_error ?? null,
        humanHandoffAcceptedAt: handoff?.provider_accepted_at ?? null,
        humanHandoffDeliveredAt: handoff?.provider_delivered_at ?? null,
        whatsappClicks: counts.whatsapp,
        locationClicks: counts.location,
        directionsClicks: counts.directions,
        callClicks: counts.call,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      }
    })

    return NextResponse.json({ conversations: flattened, totalCount: count ?? flattened.length })
  } catch (error) {
    console.error('[conversations:GET] Failed to fetch conversations', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
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

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `conv-write:${current.clinic.id}:${user.id}:${ip}`,
      limit: 60,
      windowMs: 5 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

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
    console.error('[conversations:POST] Failed to create conversation', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}
