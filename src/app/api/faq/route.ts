import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createFaqEntry, listFaqEntriesForClinic } from '@/lib/knowledge/faq'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const QUESTION_MIN = 3
const QUESTION_MAX = 300
const ANSWER_MIN = 3
const ANSWER_MAX = 5000

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const activeOnly = request.nextUrl.searchParams.get('active') === 'true'
    const faqs = await listFaqEntriesForClinic(supabase, current.clinic.id, {
      activeOnly,
    })

    return NextResponse.json(faqs)
  } catch (error) {
    console.error('[faq:GET] Failed to fetch FAQs', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => null)
    const question = String(body?.question ?? '').trim()
    const answer = String(body?.answer ?? '').trim()
    const category = body?.category ? String(body.category).trim() : null
    const order = Number(body?.order ?? 0)
    const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true

    if (!question || !answer) {
      return NextResponse.json({ error: 'question and answer are required' }, { status: 400 })
    }

    if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) {
      return NextResponse.json(
        { error: `question must be between ${QUESTION_MIN} and ${QUESTION_MAX} characters` },
        { status: 400 },
      )
    }

    if (answer.length < ANSWER_MIN || answer.length > ANSWER_MAX) {
      return NextResponse.json(
        { error: `answer must be between ${ANSWER_MIN} and ${ANSWER_MAX} characters` },
        { status: 400 },
      )
    }

    if (body?.order !== undefined && (!Number.isInteger(order) || order < 1)) {
      return NextResponse.json({ error: 'order must be a positive integer' }, { status: 400 })
    }

    const faq = await createFaqEntry(supabase, {
      clinicId: current.clinic.id,
      question,
      answer,
      category,
      sortOrder: order > 0 ? order : 1,
      isActive,
      createdBy: user.id,
    })

    return NextResponse.json(faq, { status: 201 })
  } catch (error) {
    console.error('[faq:POST] Failed to create FAQ', {
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
      { error: error instanceof Error ? error.message : 'Failed to create FAQ' },
      { status: 500 },
    )
  }
}
