import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import { normalizeUnansweredQuestion, unansweredQuestionKey } from '@/lib/unanswered/normalize'

const createUnansweredSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  question: z.string().trim().min(3).max(1000),
  sourcePage: z.string().trim().min(1).max(500).optional().nullable(),
})

function mapUnansweredRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    conversationId: row.conversation_id ?? null,
    question: row.question,
    sourcePage: row.source_page ?? null,
    reason: row.reason ?? null,
    status: row.status,
    answer: row.answer ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data: rows, error } = await supabase
      .from('unanswered_questions')
      .select('*')
      .eq('clinic_id', current.clinic.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    return NextResponse.json((rows ?? []).map((r: Record<string, unknown>) => mapUnansweredRow(r)))
  } catch (error) {
    console.error('[unanswered-questions:GET] Failed to fetch unanswered questions', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch unanswered questions' }, { status: 500 })
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

    const rl = await enforceRateLimit({
      key: `unanswered-create:${current.clinic.id}:${user.id}:${getClientIp(request.headers)}`,
      limit: 30,
      windowMs: 5 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const parsed = createUnansweredSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid unanswered payload' },
        { status: 400 },
      )
    }
    const input = parsed.data
    const normalizedQuestion = normalizeUnansweredQuestion(input.question)
    if (normalizedQuestion.length < 3) {
      return NextResponse.json({ error: 'Question must be at least 3 characters' }, { status: 400 })
    }

    if (input.conversationId) {
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', input.conversationId)
        .eq('clinic_id', current.clinic.id)
        .maybeSingle()
      if (conversationError) throw conversationError
      if (!conversation) {
        return NextResponse.json({ error: 'Invalid conversationId for this clinic' }, { status: 403 })
      }
    }

    // Dedupe: if an identical open question already exists, return it instead of creating a duplicate
    const newKey = unansweredQuestionKey(normalizedQuestion)
    const { data: existingRows, error: existingError } = await supabase
      .from('unanswered_questions')
      .select('*')
      .eq('clinic_id', current.clinic.id)
      .eq('status', 'open')
    if (existingError) throw existingError

    const existing = (existingRows ?? []).find((row: { question: string }) =>
      unansweredQuestionKey(row.question) === newKey,
    )
    if (existing) {
      return NextResponse.json(mapUnansweredRow(existing as Record<string, unknown>), { status: 200 })
    }

    const { data: created, error } = await supabase
      .from('unanswered_questions')
      .insert({
        clinic_id: current.clinic.id,
        conversation_id: input.conversationId ?? null,
        question: normalizedQuestion,
        source_page: input.sourcePage ?? null,
        status: 'open',
      })
      .select('*')
      .single()

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        const { data: rowsAfterConflict, error: lookupError } = await supabase
          .from('unanswered_questions')
          .select('*')
          .eq('clinic_id', current.clinic.id)
          .eq('status', 'open')
        if (lookupError) throw lookupError
        const existingAfterConflict = (rowsAfterConflict ?? []).find((row: { question: string }) =>
          unansweredQuestionKey(row.question) === newKey,
        )
        if (existingAfterConflict) {
          return NextResponse.json(mapUnansweredRow(existingAfterConflict as Record<string, unknown>), { status: 200 })
        }
      }
      throw error
    }

    return NextResponse.json(mapUnansweredRow(created as Record<string, unknown>), { status: 201 })
  } catch (error) {
    console.error('[unanswered-questions:POST] Failed to create unanswered question', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to create unanswered question' }, { status: 500 })
  }
}
