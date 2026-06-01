import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const reorderSchema = z.object({
  firstId: z.string().uuid(),
  secondId: z.string().uuid(),
})

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
      return NextResponse.json({ error: 'Only owners and admins can reorder FAQs.' }, { status: 403 })
    }

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `faq-reorder:${current.clinic.id}:${user.id}:${ip}`,
      limit: 60,
      windowMs: 10 * 60 * 1000,
      failOpen: true,
    })
    if (rl) return rl

    const body = await request.json().catch(() => null)
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid reorder payload.' }, { status: 400 })
    }

    if (parsed.data.firstId === parsed.data.secondId) {
      return NextResponse.json({ error: 'Cannot swap the same FAQ.' }, { status: 400 })
    }

    const { error } = await supabase.rpc('swap_faq_sort_order', {
      p_clinic_id: current.clinic.id,
      p_first_id: parsed.data.firstId,
      p_second_id: parsed.data.secondId,
    })

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to reorder FAQs.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[faq:reorder] Failed to reorder FAQs', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to reorder FAQs' }, { status: 500 })
  }
}
