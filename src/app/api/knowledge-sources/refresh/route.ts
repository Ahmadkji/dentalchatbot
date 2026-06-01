import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  listKnowledgeSourcesForClinic,
  updateKnowledgeSourceDraft,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

export const maxDuration = 60

function getStoragePathFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ''
  const value = (metadata as Record<string, unknown>).storagePath
  return typeof value === 'string' ? value.trim() : ''
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
      return NextResponse.json({ error: 'Only owners and admins can manage knowledge sources.' }, { status: 403 })
    }

    const ip = getClientIp(request.headers)
    const rl = await enforceRateLimit({
      key: `ks-refresh:${current.clinic.id}:${ip}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const { sources } = await listKnowledgeSourcesForClinic(supabase, current.clinic.id, { isActive: true })

    let queued = 0
    for (const source of sources) {
      try {
        const storagePath = source.source_type === 'file_upload' ? getStoragePathFromMetadata(source.metadata) : ''
        const fileName = typeof source.file_name === 'string' ? source.file_name.trim() : ''
        const fileMimeType = typeof source.file_type === 'string' ? source.file_type.trim() : ''

        if (source.source_type === 'file_upload' && (!storagePath || !fileName || !fileMimeType)) {
          await supabase
            .from('knowledge_sources')
            .update({
              status: 'failed',
              failed_reason:
                'Cannot refresh file source because upload metadata is incomplete. Please upload the file again.',
            })
            .eq('clinic_id', current.clinic.id)
            .eq('id', source.id)
          continue
        }

        await updateKnowledgeSourceDraft(supabase, current.clinic.id, source.id, {
          status: 'queued',
          failedReason: null,
          isActive: true,
        })

        await enqueueKnowledgeJob(supabase, {
          clinicId: current.clinic.id,
          sourceId: source.id,
          jobType:
            source.source_type === 'website_url'
              ? 'import_website_source'
              : source.source_type === 'file_upload'
                ? 'process_file_source'
                : 'process_source_content',
          payload:
            source.source_type === 'website_url'
              ? {
                  url: source.source_url,
                  importMode: 'refresh-all',
                }
              : source.source_type === 'file_upload'
                ? {
                    ...(source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)
                      ? (source.metadata as Record<string, unknown>)
                      : {}),
                    storagePath,
                    fileName,
                    mimeType: fileMimeType,
                  }
                : {
                    sourceType: source.source_type,
                  },
        })
        queued += 1
      } catch (refreshError) {
        console.error('[knowledge-sources:refresh] Source refresh failed', {
          sourceId: source.id,
          clinicId: current.clinic.id,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError),
        })
        const { error: statusUpdateError } = await supabase
          .from('knowledge_sources')
          .update({ status: 'failed', failed_reason: 'Refresh failed for this source.' })
          .eq('clinic_id', current.clinic.id)
          .eq('id', source.id)
        if (statusUpdateError) {
          console.error('[knowledge-sources:refresh] Failed to update source status to failed', {
            sourceId: source.id,
            originalError: refreshError instanceof Error ? refreshError.message : String(refreshError),
            statusUpdateError: statusUpdateError.message,
          })
        }
      }
    }

    after(() => processQueuedKnowledgeJobs({ limit: 2, runner: 'api-refresh-all' }).catch((bgError) => {
      console.error('[knowledge-sources:refresh-all] Background job processing failed', {
        runner: 'api-refresh-all',
        error: bgError instanceof Error ? bgError.message : String(bgError),
      })
    }))

    return NextResponse.json({
      refreshed: queued,
      total: sources.length,
      queued,
      message: 'Knowledge refresh queued',
    }, { status: 202 })
  } catch (error) {
    console.error('[knowledge-sources:refresh-all] Failed to refresh knowledge sources', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to refresh knowledge sources' }, { status: 500 })
  }
}
