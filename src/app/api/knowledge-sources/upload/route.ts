import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  getKnowledgeSourceForClinic,
  mapKnowledgeSource,
  updateKnowledgeSourceDraft,
  upsertKnowledgeSourceFile,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'

const KNOWLEDGE_BUCKET = 'clinic-knowledge'
export const maxDuration = 60

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
      return NextResponse.json({ error: 'Only owners and admins can manage knowledge sources.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const sourceId = String(body?.sourceId ?? '').trim()
    const storagePath = String(body?.storagePath ?? '').trim()
    const fileName = String(body?.fileName ?? '').trim()
    const mimeType = String(body?.mimeType ?? '').trim() || 'application/octet-stream'
    const fileSizeBytes = Number(body?.fileSizeBytes ?? 0)

    if (!sourceId || !storagePath || !fileName || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return NextResponse.json(
        { error: 'sourceId, storagePath, fileName, mimeType, and fileSizeBytes are required' },
        { status: 400 },
      )
    }

    const source = await getKnowledgeSourceForClinic(supabase, current.clinic.id, sourceId)
    if (!source || source.source_type !== 'file_upload') {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    await upsertKnowledgeSourceFile(supabase, {
      clinicId: current.clinic.id,
      sourceId: source.id,
      bucketName: KNOWLEDGE_BUCKET,
      storagePath,
      fileName,
      fileType: fileName.split('.').pop()?.toLowerCase() || 'bin',
      fileSizeBytes,
      mimeType,
      createdBy: user.id,
    })

    await updateKnowledgeSourceDraft(supabase, current.clinic.id, source.id, {
      title: fileName,
      fileName,
      fileType: mimeType,
      status: 'queued',
      failedReason: null,
      isActive: true,
      metadata: {
        ...(source.metadata ?? {}),
        storagePath,
        bucketName: KNOWLEDGE_BUCKET,
      },
    })

    await enqueueKnowledgeJob(supabase, {
      clinicId: current.clinic.id,
      sourceId: source.id,
      jobType: 'process_file_source',
      payload: {
        bucketName: KNOWLEDGE_BUCKET,
        storagePath,
        fileName,
        mimeType,
        fileSizeBytes,
      },
    })

    after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-upload-finalize' }).catch(() => {}))

    const refreshed = await getKnowledgeSourceForClinic(supabase, current.clinic.id, source.id)
    return NextResponse.json(refreshed ? mapKnowledgeSource(refreshed) : null, { status: 202 })
  } catch (error) {
    console.error('Error finalizing knowledge upload:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize file upload' },
      { status: 500 },
    )
  }
}
