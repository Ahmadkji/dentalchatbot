import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  disableKnowledgeSource,
  getKnowledgeSourceForClinic,
  mapKnowledgeSource,
  updateKnowledgeSourceDraft,
  hardDeleteKnowledgeSource,
  cleanupKnowledgeStorageFiles,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `ks-source-patch:${current.clinic.id}:${ip}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const { id } = await params
    const existing = await getKnowledgeSourceForClinic(supabase, current.clinic.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const nextTitle = body?.title !== undefined ? String(body.title).trim() : existing.title
    const nextContent = body?.content !== undefined ? String(body.content).trim() : existing.content
    let accepted = false

    const shouldQueueProcessing = body?.content !== undefined || body?.retrain === true
    const fileMetadata =
      existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {}
    const fileStoragePath =
      typeof fileMetadata.storagePath === 'string' ? fileMetadata.storagePath.trim() : ''
    const fileName = typeof existing.file_name === 'string' ? existing.file_name.trim() : ''
    const fileMimeType = typeof existing.file_type === 'string' ? existing.file_type.trim() : ''

    if (shouldQueueProcessing && existing.source_type === 'file_upload' && (!fileStoragePath || !fileName || !fileMimeType)) {
      return NextResponse.json(
        {
          error:
            'This file source is missing upload metadata (storage path, file name, or mime type). Please upload the file again before retraining.',
        },
        { status: 409 },
      )
    }

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

      after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-source-refresh' }).catch((bgError) => {
            console.error('[knowledge-sources:refresh-single] Background job processing failed', {
              runner: 'api-source-refresh',
              error: bgError instanceof Error ? bgError.message : String(bgError),
            })
          }))
      accepted = true
    } else {
      const updateData: Record<string, unknown> = {}

      if (body?.title !== undefined) updateData.title = nextTitle
      if (body?.content !== undefined) updateData.content = nextContent
      if (body?.sourceUrl !== undefined) updateData.sourceUrl = body.sourceUrl ? String(body.sourceUrl) : null
      if (isSourceStatus(body?.status)) updateData.status = body.status
      if (body?.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
      if (shouldQueueProcessing) {
        updateData.status = 'queued'
        updateData.failedReason = null
      }

      if (Object.keys(updateData).length > 0) {
        await updateKnowledgeSourceDraft(supabase, current.clinic.id, id, updateData)
      }

      if (shouldQueueProcessing) {
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
                  ...fileMetadata,
                  storagePath: fileStoragePath,
                  fileName,
                  mimeType: fileMimeType,
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

        after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-source-update' }).catch((bgError) => {
                console.error('[knowledge-sources:update-single] Background job processing failed', {
                  runner: 'api-source-update',
                  error: bgError instanceof Error ? bgError.message : String(bgError),
                })
              }))
        accepted = true
      }
    }

    const updated = await getKnowledgeSourceForClinic(supabase, current.clinic.id, id)
    return NextResponse.json(updated ? mapKnowledgeSource(updated) : null, { status: accepted ? 202 : 200 })
  } catch (error) {
    console.error('[knowledge-sources:update-single] Failed to update knowledge source', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to update knowledge source' }, { status: 500 })
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
      return NextResponse.json({ error: 'Only owners and admins can manage knowledge sources.' }, { status: 403 })
    }

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `ks-source-delete:${current.clinic.id}:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const { id } = await params
    const existing = await getKnowledgeSourceForClinic(supabase, current.clinic.id, id)
    if (!existing) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    // Block deletion while source is being actively processed to prevent race condition
    // with background job queue (the job would fail mid-flight with "source not found")
    if (existing.status === 'processing' || existing.status === 'queued') {
      return NextResponse.json(
        { error: 'Cannot delete a source that is currently being processed. Please wait for it to finish.' },
        { status: 409 },
      )
    }

    // FAQ-linked sources use soft-disable (FAQ entry survives with knowledge_source_id = null)
    // Non-FAQ sources use hard delete (CASCADE removes chunks, files, runs)
    if (existing.source_type === 'faq') {
      await disableKnowledgeSource(supabase, id)
      console.info('[knowledge-sources:delete] FAQ-linked source soft-disabled', {
        sourceId: id,
        clinicId: current.clinic.id,
        userId: user.id,
      })
      return NextResponse.json({ message: 'FAQ knowledge source disabled successfully' })
    }

    // Hard delete with CASCADE
    // Use authenticated client — the RPC has its own SECURITY DEFINER auth+role checks
    // via auth.uid() and has_clinic_role() which require a real user session
    const deleteResult = await hardDeleteKnowledgeSource(supabase, id)

    // Schedule background storage file cleanup using admin client
    // (storage operations bypass RLS and don't need user auth)
    if (deleteResult.storagePath && deleteResult.bucketName) {
      const adminClient = createSupabaseAdminClient()
      after(() =>
        cleanupKnowledgeStorageFiles(adminClient, deleteResult.bucketName!, deleteResult.storagePath!).catch(
          (bgError) => {
            console.error('[knowledge-sources:delete] Storage file cleanup failed', {
              sourceId: id,
              storagePath: deleteResult.storagePath,
              error: bgError instanceof Error ? bgError.message : String(bgError),
            })
          },
        ),
      )
    }

    console.info('[knowledge-sources:delete] Knowledge source permanently deleted', {
      sourceId: id,
      clinicId: current.clinic.id,
      userId: user.id,
      sourceType: deleteResult.sourceType,
      deletedChunks: deleteResult.deletedChunks,
    })

    return NextResponse.json({
      message: 'Knowledge source deleted permanently',
      deletedChunks: deleteResult.deletedChunks,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Gracefully handle double-delete: if the source was already deleted by another request,
    // the RPC raises 'Knowledge source not found.' — return 404 instead of 500
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    console.error('[knowledge-sources:delete] Failed to delete knowledge source', {
      userId: user.id,
      error: message,
    })
    return NextResponse.json({ error: 'Failed to delete knowledge source' }, { status: 500 })
  }
}