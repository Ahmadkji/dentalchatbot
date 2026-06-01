import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import {
  getLeadConflictMessage,
  leadCreateSchema,
  mapLeadRow,
  parseLeadListQuery,
} from '@/lib/leads/lead-contract'

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
    const parsedQuery = parseLeadListQuery({
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    })
    const from = (parsedQuery.page - 1) * parsedQuery.pageSize
    const to = from + parsedQuery.pageSize - 1

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('clinic_id', current.clinic.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (parsedQuery.status) {
      query = query.eq('status', parsedQuery.status)
    }

    const { data: leads, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      leads: (leads ?? []).map((row) => mapLeadRow(row)),
      page: parsedQuery.page,
      pageSize: parsedQuery.pageSize,
      totalCount: count ?? (leads ?? []).length,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid leads query parameters' }, { status: 400 })
    }
    console.error('[leads:GET] Failed to fetch leads', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
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
      key: `leads-create:${current.clinic.id}:${ip}`,
      limit: 30,
      windowMs: 5 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const parsed = leadCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid lead payload' },
        { status: 400 },
      )
    }
    const input = parsed.data

    const adminClient = createSupabaseAdminClient()
    let resolvedConversationId: string | null = null

    if (input.conversationId) {
      const { data: conversation } = await adminClient
        .from('conversations')
        .select('id')
        .eq('id', String(input.conversationId))
        .eq('clinic_id', current.clinic.id)
        .maybeSingle()

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      resolvedConversationId = conversation.id
    }

    const { data: lead, error } = await adminClient
      .from('leads')
      .insert({
        clinic_id: current.clinic.id,
        conversation_id: resolvedConversationId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        question: input.question,
        service: input.service,
        preferred_date: input.preferredDate,
        preferred_time: input.preferredTime,
        message: input.message,
        internal_note: input.internalNote,
        preferred_contact: input.preferredContact,
        status: input.status,
        source: input.source,
      })
      .select('*')
      .single()

    if (error) {
      const conflictMessage = getLeadConflictMessage(error)
      if (conflictMessage) {
        return NextResponse.json({ error: conflictMessage }, { status: 409 })
      }
      throw error
    }

    if (resolvedConversationId) {
      const { error: convUpdateError } = await adminClient
        .from('conversations')
        .update({
          lead_captured: true,
          visitor_name: String(input.name),
        })
        .eq('id', resolvedConversationId)

      if (convUpdateError) {
        console.error('[leads:POST] Failed to mark conversation lead_captured', {
          conversationId: resolvedConversationId,
          error: convUpdateError.message,
        })
        // Don't fail the request — the lead was created successfully
      }
    }

    return NextResponse.json(mapLeadRow(lead), { status: 201 })
  } catch (error) {
    console.error('[leads:POST] Failed to create lead', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
