import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  disableKnowledgeSource,
  getKnowledgeSourceForClinic,
  mapKnowledgeSource,
  updateKnowledgeSourceDraft,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'

const sourceStatuses = ['draft', 'queued', 'processing', 'trained', 'failed', 'needs_review', 'disabled'] as const
type SourceStatus = (typeof sourceStatuses)[number]

function isSourceStatus(value: unknown): value is SourceStatus {
  return typeof value === 'string' && sourceStatuses.includes(value as SourceStatus)
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
    if (!current.clinic || !current.membership) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    if (!['owner', 'admin'].includes(current.membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage knowledge sources.' }, { status: 403 })
    }

    const { id } = await params
    const existing = await getKnowledgeSourceForClinic(supabase, current.clinic.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const nextTitle = body?.title !== undefined ? String(body.title).trim() : existing.title
    const nextContent = body?.content !== undefined ? String(body.content).trim() : existing.content
    let accepted = false

    if (body?.refresh === true && existing.source_type === 'website_url' && existing.source_url) {
      await updateKnowledgeSourceDraft(supabase, current.clinic.id, id, {
        sourceUrl: existing.source_url,
        status: 'queued',
        failedReason: null,
        isActive: true,
      })

      await enqueueKnowledgeJob(supabase, {
        clinicId: current.clinic.id,
        sourceId: id,
        jobType: 'import_website_source',
        payload: {
          url: existing.source_url,
          importMode: 'refresh',
        },
      })

      after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-source-refresh' }).catch(() => {}))
      accepted = true
    } else {
      const updateData: Record<string, unknown> = {}

      if (body?.title !== undefined) updateData.title = nextTitle
      if (body?.content !== undefined) updateData.content = nextContent
      if (body?.sourceUrl !== undefined) updateData.sourceUrl = body.sourceUrl ? String(body.sourceUrl) : null
      if (isSourceStatus(body?.status)) updateData.status = body.status
      if (body?.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
      if (body?.content !== undefined || body?.retrain === true) {
        updateData.status = 'queued'
        updateData.failedReason = null
      }

      if (Object.keys(updateData).length > 0) {
        await updateKnowledgeSourceDraft(supabase, current.clinic.id, id, updateData)
      }

      if (body?.content !== undefined || body?.retrain === true) {
        const nextSourceUrl =
          body?.sourceUrl !== undefined ? (body.sourceUrl ? String(body.sourceUrl) : null) : existing.source_url

        await enqueueKnowledgeJob(supabase, {
          clinicId: current.clinic.id,
          sourceId: id,
          jobType:
            existing.source_type === 'file_upload'
              ? 'process_file_source'
              : existing.source_type === 'website_url' && body?.retrain === true
                ? 'import_website_source'
                : 'process_source_content',
          payload:
            existing.source_type === 'file_upload'
              ? {
                  ...(existing.metadata ?? {}),
                  fileName: existing.file_name,
                  mimeType: existing.file_type,
                }
              : existing.source_type === 'website_url' && body?.retrain === true
                ? {
                    url: nextSourceUrl,
                    importMode: 'retrain',
                  }
                : {
                    sourceType: existing.source_type,
                  },
        })

        after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-source-update' }).catch(() => {}))
        accepted = true
      }
    }

    const updated = await getKnowledgeSourceForClinic(supabase, current.clinic.id, id)
    return NextResponse.json(updated ? mapKnowledgeSource(updated) : null, { status: accepted ? 202 : 200 })
  } catch (error) {
    console.error('Error updating knowledge source:', error)
    return NextResponse.json({ error: 'Failed to update knowledge source' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
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
      return NextResponse.json({ error: 'Only owners and admins can manage knowledge sources.' }, { status: 403 })
    }

    const { id } = await params
    const existing = await getKnowledgeSourceForClinic(supabase, current.clinic.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    await disableKnowledgeSource(supabase, id)

    return NextResponse.json({ message: 'Knowledge source deleted successfully' })
  } catch (error) {
    console.error('Error deleting knowledge source:', error)
    return NextResponse.json({ error: 'Failed to delete knowledge source' }, { status: 500 })
  }
}
