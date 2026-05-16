import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createFaqEntry } from '@/lib/knowledge/faq'

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
    const adminClient = createSupabaseAdminClient()

    // Verify question belongs to this clinic
    const { data: existing, error: findError } = await adminClient
      .from('unanswered_questions')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', current.clinic.id)
      .maybeSingle()

    if (findError) throw findError
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData.status = body.status
    if (body.answer !== undefined) updateData.answer = String(body.answer || '').trim() || null

    const { data: updated, error } = await adminClient
      .from('unanswered_questions')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    // Add to FAQ if requested
    if (body.addToFaq === true && updated.answer && user && supabase && current.clinic && current.membership) {
      if (!['owner', 'admin'].includes(current.membership.role)) {
        return NextResponse.json({ error: 'Only owners and admins can add FAQs.' }, { status: 403 })
      }

      const existingFaqs = await supabase
        .from('faq_entries')
        .select('sort_order')
        .eq('clinic_id', current.clinic.id)
        .order('sort_order', { ascending: false })
        .limit(1)

      if (existingFaqs.error) {
        throw existingFaqs.error
      }

      await createFaqEntry(supabase, {
        clinicId: current.clinic.id,
        question: updated.question,
        answer: updated.answer,
        sortOrder: ((existingFaqs.data?.[0]?.sort_order as number | undefined) ?? 0) + 1,
        isActive: true,
        createdBy: user.id,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating unanswered question:', error)
    return NextResponse.json({ error: 'Failed to update unanswered question' }, { status: 500 })
  }
}
