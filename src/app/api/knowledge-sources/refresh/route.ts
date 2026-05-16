import { after, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  listKnowledgeSourcesForClinic,
  updateKnowledgeSourceDraft,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'

export const maxDuration = 60

export async function POST() {
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

    const sources = await listKnowledgeSourcesForClinic(supabase, current.clinic.id, { isActive: true })

    let queued = 0
    for (const source of sources) {
      try {
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
                    ...(source.metadata ?? {}),
                    fileName: source.file_name,
                    mimeType: source.file_type,
                  }
                : {
                    sourceType: source.source_type,
                  },
        })
        queued += 1
      } catch {
        await supabase
          .from('knowledge_sources')
          .update({ status: 'failed', failed_reason: 'Refresh failed for this source.' })
          .eq('clinic_id', current.clinic.id)
          .eq('id', source.id)
      }
    }

    after(() => processQueuedKnowledgeJobs({ limit: 2, runner: 'api-refresh-all' }).catch(() => {}))

    return NextResponse.json({
      refreshed: queued,
      total: sources.length,
      queued,
      message: 'Knowledge refresh queued',
    }, { status: 202 })
  } catch (error) {
    console.error('Error refreshing knowledge sources:', error)
    return NextResponse.json({ error: 'Failed to refresh knowledge sources' }, { status: 500 })
  }
}
