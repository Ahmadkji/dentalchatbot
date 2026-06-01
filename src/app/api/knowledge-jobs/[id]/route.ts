import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { getKnowledgeJobForClinic, mapKnowledgeJobProgress } from '@/lib/knowledge/jobs'

export async function GET(_request: NextRequest, context: RouteContext<'/api/knowledge-jobs/[id]'>) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage knowledge sources.' }, { status: 403 })
    }

    const { id } = await context.params
    const job = await getKnowledgeJobForClinic(supabase, current.clinic.id, id)
    if (!job) {
      return NextResponse.json({ error: 'Knowledge job not found.' }, { status: 404 })
    }

    return NextResponse.json({
      job: mapKnowledgeJobProgress(job),
    })
  } catch (error) {
    console.error('[knowledge-jobs:progress] Failed to load job progress', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load knowledge job progress.' },
      { status: 500 },
    )
  }
}
