import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import {
  extractTextFromUploadedFile,
  importSitemapContent,
  importWebsiteContent,
} from '@/lib/knowledge-import'
import {
  createKnowledgeSourceDraft,
  findKnowledgeSourceByUrl,
  getKnowledgeSourceForClinic,
  syncKnowledgeSourceContent,
  type SupabaseLikeClient,
  updateKnowledgeSourceDraft,
  upsertKnowledgeSourceFile,
} from '@/lib/knowledge/sources'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const KNOWLEDGE_BUCKET = 'clinic-knowledge'
const MAX_SITEMAP_PAGES = 10
const DEFAULT_RETRY_DELAY_SECONDS = 120
const STAGGERED_RETRY_DELAYS_SECONDS = [120, 300, 900]

export type KnowledgeJobType =
  | 'process_source_content'
  | 'import_website_source'
  | 'process_file_source'
  | 'import_sitemap'

export type KnowledgeJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface KnowledgeJobRow {
  id: string
  clinic_id: string
  source_id: string | null
  job_type: KnowledgeJobType
  status: KnowledgeJobStatus
  payload: Record<string, unknown> | null
  attempt_count: number
  max_attempts: number
  available_at: string
  started_at: string | null
  finished_at: string | null
  locked_at: string | null
  locked_by: string | null
  last_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function normalizeMetadata(metadata: unknown) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isFilePayload(payload: Record<string, unknown>) {
  return Boolean(
    asString(payload.storagePath).trim() &&
      asString(payload.fileName).trim() &&
      asString(payload.mimeType).trim(),
  )
}

function buildTemporaryWebsiteTitle(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return 'Imported website'
  }
}

export function normalizeKnowledgeJobLimit(limit: number | null | undefined) {
  if (!Number.isFinite(limit)) return 1
  return Math.max(1, Math.min(Math.trunc(limit as number), 5))
}

export function isPermanentKnowledgeJobError(message: string) {
  const lower = message.toLowerCase()
  return [
    'private or local network urls are not allowed',
    'unsupported file type',
    'no readable text found',
    'no page urls found in sitemap.xml',
    'no readable page content found',
    'please enter a valid website url',
    'only http:// and https:// urls are supported',
    'knowledge source not found',
  ].some((pattern) => lower.includes(pattern))
}

export function shouldRetryKnowledgeJob(job: Pick<KnowledgeJobRow, 'attempt_count' | 'max_attempts'>, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (isPermanentKnowledgeJobError(message)) {
    return false
  }

  return job.attempt_count < job.max_attempts
}

export function getKnowledgeJobRetryDelaySeconds(attemptCount: number) {
  if (attemptCount <= 1) return STAGGERED_RETRY_DELAYS_SECONDS[0]
  if (attemptCount === 2) return STAGGERED_RETRY_DELAYS_SECONDS[1]
  return STAGGERED_RETRY_DELAYS_SECONDS[2] ?? DEFAULT_RETRY_DELAY_SECONDS
}

export async function enqueueKnowledgeJob(
  supabase: SupabaseLikeClient,
  input: {
    clinicId: string
    sourceId?: string | null
    jobType: KnowledgeJobType
    payload?: Record<string, unknown>
    maxAttempts?: number
  },
) {
  const { data, error } = await supabase.rpc('enqueue_knowledge_job', {
    p_clinic_id: input.clinicId,
    p_source_id: input.sourceId ?? null,
    p_job_type: input.jobType,
    p_payload: input.payload ?? {},
    p_max_attempts: input.maxAttempts ?? 3,
  })

  if (error) {
    throw error
  }

  return data as KnowledgeJobRow
}

async function claimKnowledgeJobs(limit: number, runner: string) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc('claim_knowledge_jobs', {
    p_limit: normalizeKnowledgeJobLimit(limit),
    p_worker: runner,
  })

  if (error) {
    throw error
  }

  return {
    admin,
    jobs: (data ?? []) as KnowledgeJobRow[],
  }
}

async function markJobCompleted(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
) {
  const { error } = await admin
    .from('knowledge_job_queue')
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: null,
    })
    .eq('id', jobId)

  if (error) {
    throw error
  }
}

async function markJobFailed(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: KnowledgeJobRow,
  errorMessage: string,
  retry: boolean,
) {
  const payload: Record<string, unknown> = {
    status: retry ? 'queued' : 'failed',
    last_error: errorMessage,
    locked_at: null,
    locked_by: null,
    started_at: retry ? null : job.started_at,
    finished_at: retry ? null : new Date().toISOString(),
  }

  if (retry) {
    const retryDelay = getKnowledgeJobRetryDelaySeconds(job.attempt_count)
    payload.available_at = new Date(Date.now() + retryDelay * 1000).toISOString()
  }

  const { error } = await admin
    .from('knowledge_job_queue')
    .update(payload)
    .eq('id', job.id)

  if (error) {
    throw error
  }
}

async function updateSourceFailure(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
  sourceId: string | null,
  message: string,
) {
  if (!sourceId) return

  const source = await getKnowledgeSourceForClinic(admin, clinicId, sourceId)
  if (!source) return

  const preserveTrainedState = source.status === 'trained' && source.chunk_count > 0

  await updateKnowledgeSourceDraft(admin, clinicId, sourceId, {
    status: preserveTrainedState ? 'trained' : 'failed',
    failedReason: message,
  })
}

async function processSourceContentJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: KnowledgeJobRow,
) {
  if (!job.source_id) {
    throw new Error('Knowledge source not found for queued processing.')
  }

  const source = await getKnowledgeSourceForClinic(admin, job.clinic_id, job.source_id)
  if (!source) {
    throw new Error('Knowledge source not found for queued processing.')
  }

  await updateKnowledgeSourceDraft(admin, job.clinic_id, source.id, {
    status: 'processing',
    failedReason: null,
    isActive: true,
  })

  await syncKnowledgeSourceContent(admin, {
    sourceId: source.id,
    title: source.title,
    content: source.content,
    sourceType: source.source_type,
    sourceUrl: source.source_url,
    pageTitle: source.title,
    fileName: source.file_name,
  })
}

async function processWebsiteImportJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: KnowledgeJobRow,
) {
  if (!job.source_id) {
    throw new Error('Knowledge source not found for website import.')
  }

  const source = await getKnowledgeSourceForClinic(admin, job.clinic_id, job.source_id)
  if (!source) {
    throw new Error('Knowledge source not found for website import.')
  }

  const payload = normalizeMetadata(job.payload)
  const targetUrl = asString(payload.url).trim() || source.source_url || ''
  if (!targetUrl) {
    throw new Error('Website URL is missing for this knowledge import.')
  }

  const imported = await importWebsiteContent(targetUrl)

  await updateKnowledgeSourceDraft(admin, job.clinic_id, source.id, {
    title: imported.title,
    content: imported.content,
    sourceUrl: imported.url,
    status: 'processing',
    failedReason: null,
    isActive: true,
    metadata: {
      ...normalizeMetadata(source.metadata),
      ...payload,
      importedUrl: imported.url,
    },
  })

  await syncKnowledgeSourceContent(admin, {
    sourceId: source.id,
    title: imported.title,
    content: imported.content,
    sourceType: 'website_url',
    sourceUrl: imported.url,
    pageTitle: imported.title,
  })
}

async function processFileJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: KnowledgeJobRow,
) {
  if (!job.source_id) {
    throw new Error('Knowledge source not found for file processing.')
  }

  const source = await getKnowledgeSourceForClinic(admin, job.clinic_id, job.source_id)
  if (!source) {
    throw new Error('Knowledge source not found for file processing.')
  }

  const payload = normalizeMetadata(job.payload)
  if (!isFilePayload(payload)) {
    throw new Error('Queued file payload is incomplete.')
  }

  const storagePath = asString(payload.storagePath).trim()
  const fileName = asString(payload.fileName).trim()
  const mimeType = asString(payload.mimeType).trim() || 'application/octet-stream'
  const fileSizeBytes = Number(payload.fileSizeBytes ?? 0)

  const downloaded = await admin.storage.from(KNOWLEDGE_BUCKET).download(storagePath)
  if (downloaded.error || !downloaded.data) {
    throw downloaded.error ?? new Error('Uploaded file could not be found.')
  }

  const resolvedSize = fileSizeBytes > 0 ? fileSizeBytes : downloaded.data.size
  const uploadedFile = new File([downloaded.data], fileName, { type: mimeType })
  const extractedContent = await extractTextFromUploadedFile(uploadedFile)
  if (!extractedContent.trim()) {
    throw new Error('No readable text found. Please upload a text-based PDF or DOCX.')
  }

  await upsertKnowledgeSourceFile(admin, {
    clinicId: job.clinic_id,
    sourceId: source.id,
    bucketName: KNOWLEDGE_BUCKET,
      storagePath,
      fileName,
      fileType: fileName.split('.').pop()?.toLowerCase() || 'bin',
      fileSizeBytes: resolvedSize,
      mimeType,
      createdBy: job.created_by,
    })

  await updateKnowledgeSourceDraft(admin, job.clinic_id, source.id, {
    title: fileName,
    content: extractedContent,
    fileName,
    fileType: mimeType,
    status: 'processing',
    failedReason: null,
    isActive: true,
    metadata: {
      ...normalizeMetadata(source.metadata),
      ...payload,
      bucketName: KNOWLEDGE_BUCKET,
      storagePath,
    },
  })

  await syncKnowledgeSourceContent(admin, {
    sourceId: source.id,
    title: fileName,
    content: extractedContent,
    sourceType: 'file_upload',
    fileName,
    pageTitle: fileName,
  })
}

async function processSitemapJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: KnowledgeJobRow,
) {
  const payload = normalizeMetadata(job.payload)
  const sitemapUrl = asString(payload.sitemapUrl).trim()
  if (!sitemapUrl) {
    throw new Error('Sitemap URL is missing for this job.')
  }

  const imported = await importSitemapContent(sitemapUrl, MAX_SITEMAP_PAGES)

  for (const page of imported.pages) {
    const duplicate = await findKnowledgeSourceByUrl(admin, job.clinic_id, page.url)

    if (duplicate) {
      await updateKnowledgeSourceDraft(admin, job.clinic_id, duplicate.id, {
        title: page.title,
        content: page.content,
        sourceUrl: page.url,
        status: 'processing',
        failedReason: null,
        isActive: true,
        metadata: {
          ...normalizeMetadata(duplicate.metadata),
          sitemapUrl: imported.sitemapUrl,
          importedUrl: page.url,
          importMode: 'sitemap',
        },
      })

      await syncKnowledgeSourceContent(admin, {
        sourceId: duplicate.id,
        title: page.title,
        content: page.content,
        sourceType: 'website_url',
        sourceUrl: page.url,
        pageTitle: page.title,
      })
      continue
    }

    const created = await createKnowledgeSourceDraft(admin, {
      clinicId: job.clinic_id,
      title: page.title || buildTemporaryWebsiteTitle(page.url),
      sourceType: 'website_url',
      content: page.content,
      sourceUrl: page.url,
      createdBy: job.created_by,
      metadata: {
        sitemapUrl: imported.sitemapUrl,
        importedUrl: page.url,
        importMode: 'sitemap',
        parentJobId: job.id,
      },
      status: 'processing',
    })

    await syncKnowledgeSourceContent(admin, {
      sourceId: created.id,
      title: created.title,
      content: page.content,
      sourceType: 'website_url',
      sourceUrl: page.url,
      pageTitle: page.title || created.title,
    })
  }
}

async function processKnowledgeJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  job: KnowledgeJobRow,
) {
  switch (job.job_type) {
    case 'process_source_content':
      await processSourceContentJob(admin, job)
      return
    case 'import_website_source':
      await processWebsiteImportJob(admin, job)
      return
    case 'process_file_source':
      await processFileJob(admin, job)
      return
    case 'import_sitemap':
      await processSitemapJob(admin, job)
      return
    default:
      throw new Error(`Unsupported knowledge job type: ${job.job_type}`)
  }
}

export async function processQueuedKnowledgeJobs(input?: {
  limit?: number
  runner?: string
}) {
  const { admin, jobs } = await claimKnowledgeJobs(
    input?.limit ?? 1,
    input?.runner?.trim() || 'knowledge-job-runner',
  )

  let completed = 0
  let failed = 0
  let retried = 0

  for (const job of jobs) {
    try {
      await processKnowledgeJob(admin, job)
      await markJobCompleted(admin, job.id)
      completed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process knowledge job.'
      const retry = shouldRetryKnowledgeJob(job, error)
      await updateSourceFailure(admin, job.clinic_id, job.source_id, message)
      await markJobFailed(admin, job, message, retry)
      if (retry) {
        retried += 1
      } else {
        failed += 1
      }
    }
  }

  return {
    claimed: jobs.length,
    completed,
    failed,
    retried,
  }
}

export function buildKnowledgeRunnerToken(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

export function isValidKnowledgeRunnerSecret(expectedSecret: string | null | undefined, candidate: string | null) {
  if (!expectedSecret || !candidate) {
    return false
  }

  const expectedBuffer = Buffer.from(buildKnowledgeRunnerToken(expectedSecret))
  const candidateBuffer = Buffer.from(buildKnowledgeRunnerToken(candidate))

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer)
}
