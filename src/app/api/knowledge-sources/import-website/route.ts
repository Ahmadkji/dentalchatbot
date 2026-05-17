import { normalizeKnowledgeImportUrl } from '@/lib/knowledge-import'
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
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'

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

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const normalizedUrl = normalizeKnowledgeImportUrl(url).toString()
    const duplicate = await findKnowledgeSourceByUrl(supabase, current.clinic.id, normalizedUrl)

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
          importMode: 'website',
        },
      })

      await enqueueKnowledgeJob(supabase, {
        clinicId: current.clinic.id,
        sourceId: duplicate.id,
        jobType: 'import_website_source',
        payload: {
          url: normalizedUrl,
          importMode: 'website',
        },
      })

      after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-import-website' }).catch(() => {}))

      const updated = await findKnowledgeSourceByUrl(supabase, current.clinic.id, normalizedUrl)
      return NextResponse.json(updated ? mapKnowledgeSource(updated) : null, { status: 202 })
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
        importMode: 'website',
      },
      status: 'queued',
    })

    await enqueueKnowledgeJob(supabase, {
      clinicId: current.clinic.id,
      sourceId: created.id,
      jobType: 'import_website_source',
      payload: {
        url: normalizedUrl,
        importMode: 'website',
      },
    })

    after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-import-website' }).catch(() => {}))

    return NextResponse.json(created ? mapKnowledgeSource(created) : null, { status: 202 })
  } catch (error) {
    console.error('Error importing website:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to import website' }, { status: 500 })
  }
}
