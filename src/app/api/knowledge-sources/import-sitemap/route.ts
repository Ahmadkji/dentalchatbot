import { normalizeKnowledgeImportUrlForStorage } from '@/lib/knowledge-import'
import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { enqueueKnowledgeJob, mapKnowledgeJobProgress, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'
import { getActiveKnowledgeSourceCount, MAX_KNOWLEDGE_SOURCES_PER_CLINIC } from '@/lib/knowledge/sources'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

export const maxDuration = 60

const MAX_SITEMAP_PAGES = 10

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
      key: `ks-import-sitemap:${current.clinic.id}:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const body = await request.json().catch(() => null)
    const sitemapUrl = String(body?.sitemapUrl ?? '').trim()
    if (!sitemapUrl) {
      return NextResponse.json({ error: 'sitemapUrl is required' }, { status: 400 })
    }

    const normalizedSitemapUrl = normalizeKnowledgeImportUrlForStorage(sitemapUrl)

    const activeCount = await getActiveKnowledgeSourceCount(supabase, current.clinic.id)
    if (activeCount >= MAX_KNOWLEDGE_SOURCES_PER_CLINIC) {
      return NextResponse.json(
        { error: `You have reached the maximum of ${MAX_KNOWLEDGE_SOURCES_PER_CLINIC} knowledge sources. Please delete some before importing new pages.` },
        { status: 429 },
      )
    }

    const queuedJob = await enqueueKnowledgeJob(supabase, {
      clinicId: current.clinic.id,
      jobType: 'import_sitemap',
      payload: {
        sitemapUrl: normalizedSitemapUrl,
        maxPages: MAX_SITEMAP_PAGES,
      },
    })

    after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-import-sitemap' }).catch((bgError) => {
      console.error('[knowledge-sources:import-sitemap] Background job processing failed', {
        runner: 'api-import-sitemap',
        error: bgError instanceof Error ? bgError.message : String(bgError),
      })
    }))

    return NextResponse.json({
      sitemapUrl: normalizedSitemapUrl,
      importedCount: 0,
      maxPages: MAX_SITEMAP_PAGES,
      queued: true,
      message: 'Sitemap import queued for AI optimization. Pages will appear after processing finishes.',
      job: mapKnowledgeJobProgress(queuedJob),
    }, { status: 202 })
  } catch (error) {
    console.error('[knowledge-sources:import-sitemap] Failed to import sitemap', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import sitemap' },
      { status: 500 },
    )
  }
}
