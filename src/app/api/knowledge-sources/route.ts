import { after, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import {
  createKnowledgeSourceDraft,
  type KnowledgeSourceStatus,
  type KnowledgeSourceType,
  listKnowledgeSourcesForClinic,
  mapKnowledgeSource,
  validateManualKnowledgeContent,
  getActiveKnowledgeSourceCount,
  MAX_KNOWLEDGE_SOURCES_PER_CLINIC,
} from '@/lib/knowledge/sources'
import { enqueueKnowledgeJob, processQueuedKnowledgeJobs } from '@/lib/knowledge/jobs'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

function mapUiTypeToSourceType(value: string | null): KnowledgeSourceType | null {
  if (value === 'manual_text') return 'manual_text'
  if (value === 'website') return 'website_url'
  if (value === 'file') return 'file_upload'
  if (value === 'faq') return 'faq'
  return null
}

function isKnowledgeStatus(value: string | null): value is KnowledgeSourceStatus {
  return Boolean(
      value &&
      ['draft', 'queued', 'processing', 'trained', 'failed', 'needs_review', 'disabled'].includes(value),
  )
}

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = mapUiTypeToSourceType(searchParams.get('type'))
    const status = searchParams.get('status')
    const isActiveParam = searchParams.get('is_active')

    const result = await listKnowledgeSourcesForClinic(supabase, clinic.id, {
      sourceType: type,
      status: isKnowledgeStatus(status) ? status : null,
      isActive:
        isActiveParam === null ? null : isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null,
    })
    return NextResponse.json({
      sources: result.sources.map(mapKnowledgeSource),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    })
  } catch (error) {
    console.error('[knowledge-sources:GET] Failed to fetch knowledge sources', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch knowledge sources' }, { status: 500 })
  }
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
      key: `ks-source-create:${current.clinic.id}:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const body = await request.json().catch(() => null)
    const title = String(body?.title ?? '').trim()
    const content = String(body?.content ?? '').trim()
    const sourceType = mapUiTypeToSourceType(typeof body?.type === 'string' ? body.type : 'manual_text') ?? 'manual_text'

    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    if (sourceType === 'manual_text' && !validateManualKnowledgeContent(content)) {
      return NextResponse.json(
        { error: 'Manual knowledge should include enough detail to train useful answers.' },
        { status: 400 },
      )
    }

    const activeCount = await getActiveKnowledgeSourceCount(supabase, current.clinic.id)
    if (activeCount >= MAX_KNOWLEDGE_SOURCES_PER_CLINIC) {
      return NextResponse.json(
        { error: `You have reached the maximum of ${MAX_KNOWLEDGE_SOURCES_PER_CLINIC} knowledge sources. Please delete some before adding new ones.` },
        { status: 429 },
      )
    }

    const created = await createKnowledgeSourceDraft(supabase, {
      clinicId: current.clinic.id,
      title,
      sourceType,
      content,
      createdBy: user.id,
      status: 'queued',
    })

    await enqueueKnowledgeJob(supabase, {
      clinicId: current.clinic.id,
      sourceId: created.id,
      jobType: 'process_source_content',
      payload: {
        sourceType,
      },
    })

    after(() => processQueuedKnowledgeJobs({ limit: 1, runner: 'api-knowledge-post' }).catch((bgError) => {
      console.error('[knowledge-sources:POST] Background job processing failed', {
        runner: 'api-knowledge-post',
        error: bgError instanceof Error ? bgError.message : String(bgError),
      })
    }))

    return NextResponse.json(created ? mapKnowledgeSource(created) : null, { status: 202 })
  } catch (error) {
    console.error('[knowledge-sources:POST] Failed to create knowledge source', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to create knowledge source' }, { status: 500 })
  }
}
