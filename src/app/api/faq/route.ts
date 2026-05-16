import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createFaqEntry, listFaqEntriesForClinic } from '@/lib/knowledge/faq'

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
    console.error('Error fetching FAQs:', error)
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

    const body = await request.json().catch(() => null)
    const question = String(body?.question ?? '').trim()
    const answer = String(body?.answer ?? '').trim()
    const category = body?.category ? String(body.category).trim() : null
    const order = Number(body?.order ?? 0)
    const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true

    if (!question || !answer) {
      return NextResponse.json({ error: 'question and answer are required' }, { status: 400 })
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
    console.error('Error creating FAQ:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create FAQ' },
      { status: 500 },
    )
  }
}
