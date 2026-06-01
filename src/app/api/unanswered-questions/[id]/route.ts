import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { syncFaqEntryKnowledgeSource } from '@/lib/knowledge/faq'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const patchSchema = z
  .object({
    status: z.enum(['open', 'answered', 'ignored']).optional(),
    answer: z.string().trim().min(1).max(5000).nullable().optional(),
    addToFaq: z.boolean().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.answer !== undefined || v.addToFaq !== undefined,
    { message: 'At least one update field is required' },
  )

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const rl = await enforceRateLimit({
      key: `unanswered-update:${current.clinic.id}:${user.id}:${getClientIp(request.headers)}`,
      limit: 60,
      windowMs: 5 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid unanswered patch payload' },
        { status: 400 },
      )
    }
    const body = parsed.data

    // Permission check BEFORE any write — prevents partial-write bug
    if (
      body.addToFaq === true &&
      (!current.membership || !['owner', 'admin'].includes(current.membership.role))
    ) {
      return NextResponse.json({ error: 'Only owners and admins can add FAQs.' }, { status: 403 })
    }

    const { id } = await params

    const { data: resolved, error: resolveError } = await supabase
      .rpc('resolve_unanswered_question_atomic', {
        p_clinic_id: current.clinic.id,
        p_question_id: id,
        p_status: body.status ?? null,
        p_answer: body.answer ?? null,
        p_add_to_faq: body.addToFaq ?? false,
      })
      .maybeSingle()

    if (resolveError) {
      const msg = resolveError.message || 'Failed to update unanswered question'
      if (msg.includes('Question not found')) {
        return NextResponse.json({ error: msg }, { status: 404 })
      }
      if ((resolveError as { code?: string }).code === '42501') {
        return NextResponse.json({ error: msg }, { status: 403 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!resolved) {
      return NextResponse.json(
        { error: 'Unexpected empty response from resolver.' },
        { status: 500 },
      )
    }

    const resolvedRow = resolved as Record<string, unknown> & {
      faq_entry_id?: string | null
      faq_created?: boolean
    }

    let knowledgeSync: 'skipped' | 'ok' | 'failed' = 'skipped'
    let warning: string | undefined

    if (resolvedRow.faq_entry_id) {
      try {
        await syncFaqEntryKnowledgeSource(
          supabase,
          current.clinic.id,
          resolvedRow.faq_entry_id,
        )
        knowledgeSync = 'ok'
      } catch (syncError) {
        knowledgeSync = 'failed'
        warning =
          'Answer and FAQ were saved, but FAQ knowledge sync failed. Retry from FAQ Builder.'
        console.error('FAQ knowledge sync failed after atomic resolve:', syncError)
      }
    }

    const { data: responseRow, error: responseRowError } = await supabase
      .from('unanswered_questions')
      .select('id, conversation_id, question, source_page, reason, status, answer, created_at, updated_at')
      .eq('id', resolvedRow.id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (responseRowError) {
      throw responseRowError
    }

    return NextResponse.json({
      ...mapUnansweredRow((responseRow ?? resolvedRow) as Record<string, unknown>),
      faqEntryId: resolvedRow.faq_entry_id ?? null,
      faqCreated: Boolean(resolvedRow.faq_created),
      knowledgeSync,
      ...(warning ? { warning } : {}),
    })
  } catch (error) {
    console.error('[unanswered-questions:PATCH] Failed to update unanswered question', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to update unanswered question' }, { status: 500 })
  }
}
