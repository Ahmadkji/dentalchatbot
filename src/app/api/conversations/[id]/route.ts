import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import { normalizeUnansweredQuestion, unansweredQuestionKey } from '@/lib/unanswered/normalize'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

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
    console.error('[conversations:GET] Failed to fetch conversation', {
      conversationId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
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
  const { id } = await params

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const rl = await enforceRateLimit({
      key: `conv-update:${current.clinic.id}:${user.id}:${getClientIp(request.headers)}`,
      limit: 60,
      windowMs: 5 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const patchSchema = z
      .object({
        status: z.enum(['active', 'pending', 'closed']).optional(),
        helpfulStatus: z.enum(['helpful', 'not_helpful', 'unreviewed']).optional(),
        needsImprovement: z.boolean().optional(),
        leadCaptured: z.boolean().optional(),
        appointmentRequested: z.boolean().optional(),
        sourcePage: z.string().trim().min(1).max(500).nullable().optional(),
      })
      .refine(
        (v) =>
          v.status !== undefined ||
          v.helpfulStatus !== undefined ||
          v.needsImprovement !== undefined ||
          v.leadCaptured !== undefined ||
          v.appointmentRequested !== undefined ||
          v.sourcePage !== undefined,
        { message: 'At least one update field is required' },
      )

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid patch payload' },
        { status: 400 },
      )
    }
    const body = parsed.data

    const adminClient = createSupabaseAdminClient()

    // Verify conversation belongs to this clinic
    const { data: existing, error: findError } = await adminClient
      .from('conversations')
      .select('id, clinic_id, helpful_status, source_page')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.helpfulStatus !== undefined) updateData.helpful_status = body.helpfulStatus
    if (body.needsImprovement !== undefined) updateData.needs_improvement = body.needsImprovement
    if (body.leadCaptured !== undefined) updateData.lead_captured = body.leadCaptured
    if (body.appointmentRequested !== undefined) updateData.appointment_requested = body.appointmentRequested
    if (body.sourcePage !== undefined) updateData.source_page = body.sourcePage
    if (body.helpfulStatus === 'not_helpful' && body.needsImprovement === undefined) {
      updateData.needs_improvement = true
    }

    const { data: conversation, error } = await adminClient
      .from('conversations')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    const shouldCreateUnansweredFromReview =
      body.helpfulStatus === 'not_helpful' && existing.helpful_status !== 'not_helpful'

    if (shouldCreateUnansweredFromReview) {
      const { data: latestUserMessage, error: latestUserMessageError } = await adminClient
        .from('conversation_messages')
        .select('content')
        .eq('conversation_id', id)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latestUserMessageError) throw latestUserMessageError

      const normalizedQuestion = normalizeUnansweredQuestion(latestUserMessage?.content ?? '')
      if (normalizedQuestion.length >= 3) {
        const newKey = unansweredQuestionKey(normalizedQuestion)
        const { data: openRows, error: openRowsError } = await adminClient
          .from('unanswered_questions')
          .select('id, question')
          .eq('clinic_id', current.clinic.id)
          .eq('status', 'open')
        if (openRowsError) throw openRowsError

        const duplicate = (openRows ?? []).some((row: { question: string }) =>
          unansweredQuestionKey(row.question) === newKey,
        )

        if (!duplicate) {
          const { error: unansweredInsertError } = await adminClient
            .from('unanswered_questions')
            .insert({
              clinic_id: current.clinic.id,
              conversation_id: id,
              question: normalizedQuestion,
              source_page: conversation.source_page || existing.source_page || '/',
              reason: 'unsupported_topic',
              status: 'open',
            })

          if (unansweredInsertError && (unansweredInsertError as { code?: string }).code !== '23505') {
            throw unansweredInsertError
          }
        }
      }
    }

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
    console.error('[conversations:PATCH] Failed to update conversation', {
      conversationId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}
