import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { deleteFaqEntry, getFaqEntryForClinic, updateFaqEntry } from '@/lib/knowledge/faq'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

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
    const updated = await updateFaqEntry(supabase, current.clinic.id, id, {
      question: body?.question !== undefined ? String(body.question).trim() : undefined,
      answer: body?.answer !== undefined ? String(body.answer).trim() : undefined,
      category: body?.category !== undefined ? (body.category ? String(body.category).trim() : null) : undefined,
      order: body?.order !== undefined ? Number(body.order) : undefined,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating FAQ:', error)
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
    console.error('Error deleting FAQ:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete FAQ' },
      { status: 500 },
    )
  }
}
