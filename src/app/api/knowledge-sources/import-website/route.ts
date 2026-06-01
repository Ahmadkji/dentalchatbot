import { normalizeKnowledgeImportUrlForStorage } from '@/lib/knowledge-import'
import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import {
  createKnowledgeSourceDraft,
  findKnowledgeSourceByUrl,
  mapKnowledgeSource,
  updateKnowledgeSourceDraft,
  getActiveKnowledgeSourceCount,
  MAX_KNOWLEDGE_SOURCES_PER_CLINIC,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, mapKnowledgeJobProgress, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'

export const maxDuration = 30

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
      key: `ks-import-web:${current.clinic.id}:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const body = await request.json().catch(() => null)
    const url = String(body?.url ?? '').trim()
    const importMode = String(body?.importMode ?? '').trim() === 'homepage' ? 'homepage' : 'website'

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const normalizedUrl = normalizeKnowledgeImportUrlForStorage(url)
    const duplicate = await findKnowledgeSourceByUrl(supabase, current.clinic.id, normalizedUrl)

    // Duplicate re-import doesn't count against the limit
    if (!duplicate) {
      const activeCount = await getActiveKnowledgeSourceCount(supabase, current.clinic.id)
      if (activeCount >= MAX_KNOWLEDGE_SOURCES_PER_CLINIC) {
        return NextResponse.json(
          { error: `You have reached the maximum of ${MAX_KNOWLEDGE_SOURCES_PER_CLINIC} knowledge sources. Please delete some before adding new ones.` },
          { status: 429 },
        )
      }
    }

    if (duplicate) {
      await updateKnowledgeSourceDraft(supabase, current.clinic.id, duplicate.id, {
        title: duplicate.title || new URL(normalizedUrl).hostname,
        sourceUrl: normalizedUrl,
        status: 'queued',
        failedReason: null,
        isActive: true,
        metadata: {
          ...(duplicate.metadata ?? {}),
          importedUrl: normalizedUrl,
          importMode,
        },
      })

      const queuedJob = await enqueueKnowledgeJob(supabase, {
        clinicId: current.clinic.id,
        sourceId: duplicate.id,
        jobType: 'import_website_source',
        payload: {
          url: normalizedUrl,
          importMode,
        },
      })

      after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-import-website' }).catch((bgError) => {
        console.error('[knowledge-sources:import-website] Background job processing failed', {
          runner: 'api-import-website',
          error: bgError instanceof Error ? bgError.message : String(bgError),
        })
      }))

      const updated = await findKnowledgeSourceByUrl(supabase, current.clinic.id, normalizedUrl)
      return NextResponse.json(
        updated
          ? {
              ...mapKnowledgeSource(updated),
              job: mapKnowledgeJobProgress(queuedJob),
              message: importMode === 'homepage'
                ? 'Homepage crawl queued for AI optimization.'
                : 'Website page import queued for AI optimization.',
            }
          : null,
        { status: 202 },
      )
    }

    const created = await createKnowledgeSourceDraft(supabase, {
      clinicId: current.clinic.id,
      title: new URL(normalizedUrl).hostname,
      sourceType: 'website_url',
      content: '',
      sourceUrl: normalizedUrl,
      createdBy: user.id,
      metadata: {
        importedUrl: normalizedUrl,
        importMode,
      },
      status: 'queued',
    })

    const queuedJob = await enqueueKnowledgeJob(supabase, {
      clinicId: current.clinic.id,
      sourceId: created.id,
      jobType: 'import_website_source',
      payload: {
        url: normalizedUrl,
        importMode,
      },
    })

    after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-import-website' }).catch((bgError) => {
      console.error('[knowledge-sources:import-website] Background job processing failed', {
        runner: 'api-import-website',
        error: bgError instanceof Error ? bgError.message : String(bgError),
      })
    }))

    return NextResponse.json(
      created
        ? {
            ...mapKnowledgeSource(created),
            job: mapKnowledgeJobProgress(queuedJob),
            message: importMode === 'homepage'
              ? 'Homepage crawl queued for AI optimization.'
              : 'Website page import queued for AI optimization.',
          }
        : null,
      { status: 202 },
    )
  } catch (error) {
    console.error('[knowledge-sources:import-website] Failed to import website', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to import website' }, { status: 500 })
  }
}
