import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { deleteFaqEntry, getFaqEntryForClinic, updateFaqEntry } from '@/lib/knowledge/faq'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const QUESTION_MIN = 3
const QUESTION_MAX = 300
const ANSWER_MIN = 3
const ANSWER_MAX = 5000

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage FAQs.' }, { status: 403 })
    }

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `faq-write:${current.clinic.id}:${user.id}:${ip}`,
      limit: 40,
      windowMs: 10 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const { id } = await params
    const existing = await getFaqEntryForClinic(supabase, current.clinic.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)

    const nextQuestion = body?.question !== undefined ? String(body.question).trim() : undefined
    const nextAnswer = body?.answer !== undefined ? String(body.answer).trim() : undefined
    const nextCategory = body?.category !== undefined ? (body.category ? String(body.category).trim() : null) : undefined
    const nextOrder = body?.order !== undefined ? Number(body.order) : undefined
    const nextIsActive = body?.isActive !== undefined ? Boolean(body.isActive) : undefined

    if (
      nextQuestion === undefined &&
      nextAnswer === undefined &&
      nextCategory === undefined &&
      nextOrder === undefined &&
      nextIsActive === undefined
    ) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
    }

    if (nextQuestion !== undefined && (nextQuestion.length < QUESTION_MIN || nextQuestion.length > QUESTION_MAX)) {
      return NextResponse.json(
        { error: `question must be between ${QUESTION_MIN} and ${QUESTION_MAX} characters` },
        { status: 400 },
      )
    }

    if (nextAnswer !== undefined && (nextAnswer.length < ANSWER_MIN || nextAnswer.length > ANSWER_MAX)) {
      return NextResponse.json(
        { error: `answer must be between ${ANSWER_MIN} and ${ANSWER_MAX} characters` },
        { status: 400 },
      )
    }

    if (nextOrder !== undefined && (!Number.isInteger(nextOrder) || nextOrder < 1)) {
      return NextResponse.json({ error: 'order must be a positive integer' }, { status: 400 })
    }

    const updated = await updateFaqEntry(supabase, current.clinic.id, id, {
      question: nextQuestion,
      answer: nextAnswer,
      category: nextCategory,
      order: nextOrder,
      isActive: nextIsActive,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[faq:PATCH] Failed to update FAQ', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })

    // Map DB check-constraint violations to 400
    if (
      typeof error === 'object' && error && 'code' in error &&
      (error as { code?: string }).code === '23514'
    ) {
      return NextResponse.json({ error: 'FAQ validation failed.' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update FAQ' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage FAQs.' }, { status: 403 })
    }

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `faq-write:${current.clinic.id}:${user.id}:${ip}`,
      limit: 40,
      windowMs: 10 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const { id } = await params
    const deleted = await deleteFaqEntry(supabase, current.clinic.id, id)
    if (!deleted) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'FAQ deleted successfully' })
  } catch (error) {
    console.error('[faq:DELETE] Failed to delete FAQ', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete FAQ' },
      { status: 500 },
    )
  }
}
