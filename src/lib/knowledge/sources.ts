import 'server-only'

import { createHash } from 'node:crypto'
import { embedText384, embedTexts384, serializePgVector } from '@/lib/knowledge/embeddings'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type KnowledgeSourceType = 'manual_text' | 'website_url' | 'file_upload' | 'faq'
export type KnowledgeSourceStatus =
  | 'draft'
  | 'queued'
  | 'processing'
  | 'trained'
  | 'failed'
  | 'needs_review'
  | 'disabled'

export type KnowledgeSourceUiType = 'manual_text' | 'website' | 'file' | 'faq'

export interface KnowledgeSourceRow {
  id: string
  clinic_id: string
  title: string
  source_type: KnowledgeSourceType
  content: string
  source_url: string | null
  file_name: string | null
  file_type: string | null
  status: KnowledgeSourceStatus
  is_active: boolean
  chunk_count: number
  trained_at: string | null
  last_synced_at: string | null
  failed_reason: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface KnowledgeSourceFileRow {
  id: string
  clinic_id: string
  source_id: string
  bucket_name: string
  storage_path: string
  file_name: string
  file_type: string
  file_size_bytes: number
  mime_type: string
  upload_status: 'uploaded' | 'failed' | 'deleted'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeSourceChunkSearchRow {
  id: string
  clinic_id: string
  source_id: string
  chunk_text: string
  sort_order: number
  token_count: number
  source_type: KnowledgeSourceType
  source_url: string | null
  page_title: string | null
  section_heading: string | null
  file_name: string | null
  last_synced_at: string | null
  updated_at: string
  retrieval_score?: number
  score_type?: string
  knowledge_sources: {
    id: string
    title: string
    source_type: KnowledgeSourceType
    status: KnowledgeSourceStatus
    is_active: boolean
  }
}

export type SupabaseLikeClient = {
  from: any
  rpc: any
  storage?: any
}

const knowledgeSourceSelect =
  'id,clinic_id,title,source_type,content,source_url,file_name,file_type,status,is_active,chunk_count,trained_at,last_synced_at,failed_reason,metadata,created_at,updated_at'

const chunkSelect = [
  'id',
  'clinic_id',
  'source_id',
  'chunk_text',
  'sort_order',
  'token_count',
  'source_type',
  'source_url',
  'page_title',
  'section_heading',
  'file_name',
  'last_synced_at',
  'updated_at',
  'knowledge_sources!inner(id,title,source_type,status,is_active)',
].join(',')

const CHUNK_CHARACTER_LIMIT = 4200
const CHUNK_OVERLAP_CHARACTERS = 600
const MIN_MANUAL_TEXT_LENGTH = 40

const sourcePriority: Record<KnowledgeSourceType, number> = {
  faq: 400,
  manual_text: 300,
  file_upload: 200,
  website_url: 100,
}

function mapDbSourceTypeToUiType(sourceType: KnowledgeSourceType): KnowledgeSourceUiType {
  if (sourceType === 'website_url') return 'website'
  if (sourceType === 'file_upload') return 'file'
  return sourceType
}

function normalizeMetadata(metadata: unknown) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : null
}

export function estimateKnowledgeTokens(text: string) {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 0.75))
}

export function validateManualKnowledgeContent(text: string) {
  return text.trim().length >= MIN_MANUAL_TEXT_LENGTH
}

export function splitKnowledgeContentIntoChunks(text: string) {
  const clean = text.trim()
  if (!clean) return []

  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= CHUNK_CHARACTER_LIMIT) {
      current = candidate
      continue
    }

    if (current) {
      chunks.push(current)
      const overlap = current.slice(-CHUNK_OVERLAP_CHARACTERS).trim()
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph
      continue
    }

    let start = 0
    while (start < paragraph.length) {
      const end = Math.min(start + CHUNK_CHARACTER_LIMIT, paragraph.length)
      const piece = paragraph.slice(start, end).trim()
      if (piece) chunks.push(piece)
      if (end >= paragraph.length) break
      start = Math.max(0, end - CHUNK_OVERLAP_CHARACTERS)
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function buildKnowledgeChunkPayload(
  text: string,
  metadata: {
    sourceType: KnowledgeSourceType
    sourceUrl?: string | null
    pageTitle?: string | null
    sectionHeading?: string | null
    fileName?: string | null
  },
) {
  return splitKnowledgeContentIntoChunks(text).map((chunkText, index) => ({
    chunk_text: chunkText,
    sort_order: index + 1,
    token_count: estimateKnowledgeTokens(chunkText),
    content_hash: createHash('sha256').update(chunkText).digest('hex'),
    source_type: metadata.sourceType,
    source_url: metadata.sourceUrl ?? null,
    page_title: metadata.pageTitle ?? null,
    section_heading: metadata.sectionHeading ?? null,
    file_name: metadata.fileName ?? null,
  }))
}

function normalizeSearchTerms(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s+-]/g, ' ')
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  )
}

function computeChunkScore(
  row: KnowledgeSourceChunkSearchRow,
  keywords: string[],
) {
  const haystack = [
    row.chunk_text,
    row.section_heading ?? '',
    row.page_title ?? '',
    row.knowledge_sources?.title ?? '',
  ]
    .join(' ')
    .toLowerCase()

  const keywordHits = keywords.reduce((count, keyword) => {
    if (!haystack.includes(keyword)) return count
    return count + 1
  }, 0)

  const priority = sourcePriority[row.source_type] ?? 0
  const headingBonus = row.section_heading ? 25 : 0

  return priority + headingBonus + keywordHits * 10
}

export function mapKnowledgeSource(row: KnowledgeSourceRow) {
  return {
    id: row.id,
    title: row.title,
    type: mapDbSourceTypeToUiType(row.source_type),
    sourceType: row.source_type,
    content: row.content,
    sourceUrl: row.source_url,
    fileName: row.file_name,
    fileType: row.file_type,
    status: row.status,
    isActive: row.is_active,
    chunkCount: row.chunk_count,
    trainedAt: row.trained_at,
    lastSyncedAt: row.last_synced_at,
    errorMessage: row.failed_reason,
    metadata: normalizeMetadata(row.metadata),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export async function listKnowledgeSourcesForClinic(
  supabase: SupabaseLikeClient,
  clinicId: string,
  filters?: {
    sourceType?: KnowledgeSourceType | null
    status?: KnowledgeSourceStatus | null
    isActive?: boolean | null
    includeFaq?: boolean
  },
) {
  let query = supabase
    .from('knowledge_sources')
    .select(knowledgeSourceSelect)
    .eq('clinic_id', clinicId)
    .order('updated_at', { ascending: false })

  if (!filters?.includeFaq) {
    query = query.neq('source_type', 'faq')
  }

  if (filters?.sourceType) {
    query = query.eq('source_type', filters.sourceType)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (typeof filters?.isActive === 'boolean') {
    query = query.eq('is_active', filters.isActive)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return (data ?? []) as KnowledgeSourceRow[]
}

export async function getKnowledgeSourceForClinic(
  supabase: SupabaseLikeClient,
  clinicId: string,
  sourceId: string,
) {
  const { data, error } = await supabase
    .from('knowledge_sources')
    .select(knowledgeSourceSelect)
    .eq('clinic_id', clinicId)
    .eq('id', sourceId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as KnowledgeSourceRow | null) ?? null
}

export async function findKnowledgeSourceByUrl(
  supabase: SupabaseLikeClient,
  clinicId: string,
  url: string,
) {
  const { data, error } = await supabase
    .from('knowledge_sources')
    .select(knowledgeSourceSelect)
    .eq('clinic_id', clinicId)
    .eq('source_type', 'website_url')
    .eq('source_url', url)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as KnowledgeSourceRow | null) ?? null
}

export async function createKnowledgeSourceDraft(
  supabase: SupabaseLikeClient,
  input: {
    clinicId: string
    title: string
    sourceType: KnowledgeSourceType
    content?: string
    sourceUrl?: string | null
    fileName?: string | null
    fileType?: string | null
    createdBy?: string | null
    metadata?: Record<string, unknown>
    status?: KnowledgeSourceStatus
  },
) {
  const { data, error } = await supabase
    .from('knowledge_sources')
    .insert({
      clinic_id: input.clinicId,
      title: input.title,
      source_type: input.sourceType,
      content: input.content ?? '',
      source_url: input.sourceUrl ?? null,
      file_name: input.fileName ?? null,
      file_type: input.fileType ?? null,
      status: input.status ?? 'draft',
      is_active: true,
      chunk_count: 0,
      trained_at: null,
      last_synced_at: null,
      failed_reason: null,
      created_by: input.createdBy ?? null,
      metadata: input.metadata ?? {},
    })
    .select(knowledgeSourceSelect)
    .single()

  if (error) {
    throw error
  }

  return data as KnowledgeSourceRow
}

export async function upsertKnowledgeSourceFile(
  supabase: SupabaseLikeClient,
  input: {
    clinicId: string
    sourceId: string
    bucketName: string
    storagePath: string
    fileName: string
    fileType: string
    fileSizeBytes: number
    mimeType: string
    createdBy?: string | null
    uploadStatus?: KnowledgeSourceFileRow['upload_status']
  },
) {
  const { data, error } = await supabase
    .from('knowledge_source_files')
    .upsert(
      {
        clinic_id: input.clinicId,
        source_id: input.sourceId,
        bucket_name: input.bucketName,
        storage_path: input.storagePath,
        file_name: input.fileName,
        file_type: input.fileType,
        file_size_bytes: input.fileSizeBytes,
        mime_type: input.mimeType,
        upload_status: input.uploadStatus ?? 'uploaded',
        created_by: input.createdBy ?? null,
      },
      {
        onConflict: 'source_id',
      },
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as KnowledgeSourceFileRow
}

function buildEmbeddingPayloadForChunks(chunks: Array<{ chunk_text: string; sort_order: number }>) {
  return async () => {
    const response = await embedTexts384(chunks.map((chunk) => chunk.chunk_text))

    return chunks.flatMap((chunk, index) => {
      const vector = response.vectors[index]
      if (!Array.isArray(vector) || vector.length !== 384) {
        return []
      }

      return [{
        sort_order: chunk.sort_order,
        embedding_384: serializePgVector(vector),
      }]
    })
  }
}

export async function syncKnowledgeSourceContent(
  supabase: SupabaseLikeClient,
  input: {
    sourceId: string
    title: string
    content: string
    sourceType: KnowledgeSourceType
    sourceUrl?: string | null
    pageTitle?: string | null
    sectionHeading?: string | null
    fileName?: string | null
    lastSyncedAt?: string
  },
) {
  const chunks = buildKnowledgeChunkPayload(input.content, {
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    pageTitle: input.pageTitle ?? input.title,
    sectionHeading: input.sectionHeading ?? null,
    fileName: input.fileName,
  })

  const status: KnowledgeSourceStatus = chunks.length > 0 ? 'trained' : 'failed'
  const failedReason = chunks.length > 0 ? null : 'No readable text found in source.'

  const { error } = await supabase.rpc('replace_knowledge_source_chunks', {
    p_source_id: input.sourceId,
    p_title: input.title,
    p_content: input.content,
    p_status: status,
    p_failed_reason: failedReason,
    p_chunks: chunks,
    p_last_synced_at: input.lastSyncedAt ?? new Date().toISOString(),
  })

  if (error) {
    throw new Error(error.message || 'Failed to sync knowledge source.')
  }

  if (chunks.length === 0) {
    return
  }

  try {
    const embeddings = await buildEmbeddingPayloadForChunks(chunks)()
    if (embeddings.length > 0) {
      const admin = createSupabaseAdminClient()
      await admin.rpc('update_knowledge_chunk_embeddings_384', {
        p_source_id: input.sourceId,
        p_embeddings: embeddings,
        p_embedding_model: 'gte-small',
      })
    }
  } catch (embeddingError) {
    console.warn('Embedding generation failed, keeping lexical search active:', embeddingError)
  }
}

export async function createKnowledgeSourceRecord(
  supabase: SupabaseLikeClient,
  input: {
    clinicId: string
    title: string
    sourceType: KnowledgeSourceType
    content: string
    sourceUrl?: string | null
    fileName?: string | null
    fileType?: string | null
    createdBy?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const created = await createKnowledgeSourceDraft(supabase, {
    clinicId: input.clinicId,
    title: input.title,
    sourceType: input.sourceType,
    content: input.content,
    sourceUrl: input.sourceUrl ?? null,
    fileName: input.fileName ?? null,
    fileType: input.fileType ?? null,
    createdBy: input.createdBy ?? null,
    metadata: input.metadata,
    status: 'processing',
  })

  try {
    await syncKnowledgeSourceContent(supabase, {
      sourceId: created.id,
      title: input.title,
      content: input.content,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      pageTitle: input.title,
      fileName: input.fileName ?? null,
    })
  } catch (syncError) {
    await supabase
      .from('knowledge_sources')
      .update({
        status: 'failed',
        failed_reason:
          syncError instanceof Error
            ? syncError.message
            : 'Failed to process knowledge source.',
      })
      .eq('id', created.id)

    throw syncError
  }

  return await getKnowledgeSourceForClinic(supabase, input.clinicId, created.id)
}

export async function updateKnowledgeSourceDraft(
  supabase: SupabaseLikeClient,
  clinicId: string,
  sourceId: string,
  patch: Partial<{
    title: string
    content: string
    sourceUrl: string | null
    fileName: string | null
    fileType: string | null
    status: KnowledgeSourceStatus
    isActive: boolean
    metadata: Record<string, unknown>
    failedReason: string | null
  }>,
) {
  const updateData: Record<string, unknown> = {}

  if (patch.title !== undefined) updateData.title = patch.title
  if (patch.content !== undefined) updateData.content = patch.content
  if (patch.sourceUrl !== undefined) updateData.source_url = patch.sourceUrl
  if (patch.fileName !== undefined) updateData.file_name = patch.fileName
  if (patch.fileType !== undefined) updateData.file_type = patch.fileType
  if (patch.status !== undefined) updateData.status = patch.status
  if (patch.isActive !== undefined) updateData.is_active = patch.isActive
  if (patch.metadata !== undefined) updateData.metadata = patch.metadata
  if (patch.failedReason !== undefined) updateData.failed_reason = patch.failedReason

  if (Object.keys(updateData).length === 0) {
    return getKnowledgeSourceForClinic(supabase, clinicId, sourceId)
  }

  const { error } = await supabase
    .from('knowledge_sources')
    .update(updateData)
    .eq('clinic_id', clinicId)
    .eq('id', sourceId)

  if (error) {
    throw error
  }

  return getKnowledgeSourceForClinic(supabase, clinicId, sourceId)
}

export async function disableKnowledgeSource(
  supabase: SupabaseLikeClient,
  sourceId: string,
) {
  const { data, error } = await supabase.rpc('disable_knowledge_source', {
    p_source_id: sourceId,
  })

  if (error) {
    throw new Error(error.message || 'Failed to disable knowledge source.')
  }

  return data as KnowledgeSourceRow
}

function scoreLexicalChunk(row: KnowledgeSourceChunkSearchRow, keywords: string[]) {
  return computeChunkScore(row, keywords)
}

function mergeHybridKnowledgeResults(
  lexicalRows: KnowledgeSourceChunkSearchRow[],
  vectorRows: KnowledgeSourceChunkSearchRow[],
  limit: number,
) {
  const merged = new Map<string, KnowledgeSourceChunkSearchRow>()

  for (const row of lexicalRows) {
    merged.set(row.id, {
      ...row,
      retrieval_score: row.retrieval_score ?? 0.55,
      score_type: 'lexical',
    })
  }

  for (const row of vectorRows) {
    const existing = merged.get(row.id)
    if (!existing) {
      merged.set(row.id, row)
      continue
    }

    merged.set(row.id, {
      ...existing,
      retrieval_score: Math.max(existing.retrieval_score ?? 0, row.retrieval_score ?? 0),
      score_type: 'hybrid',
    })
  }

  return [...merged.values()]
    .sort((left, right) => (right.retrieval_score ?? 0) - (left.retrieval_score ?? 0))
    .slice(0, limit)
}

export async function searchKnowledgeChunks(
  supabase: SupabaseLikeClient,
  clinicId: string,
  query: string,
  options?: {
    limit?: number
    sourceTypes?: KnowledgeSourceType[]
  },
) {
  const keywords = normalizeSearchTerms(query)
  if (keywords.length === 0) {
    return [] as KnowledgeSourceChunkSearchRow[]
  }

  let searchQuery = supabase
    .from('knowledge_chunks')
    .select(chunkSelect)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .eq('knowledge_sources.status', 'trained')
    .eq('knowledge_sources.is_active', true)
    .textSearch('search_document', keywords.join(' '), {
      config: 'simple',
      type: 'plain',
    })
    .order('updated_at', { ascending: false })
    .limit(Math.max((options?.limit ?? 5) * 4, 8))

  if (options?.sourceTypes?.length) {
    searchQuery = searchQuery.in('source_type', options.sourceTypes)
  }

  const { data, error } = await searchQuery
  if (error) {
    throw error
  }

  const lexicalRows = ((data ?? []) as KnowledgeSourceChunkSearchRow[])
    .map((row) => ({
      ...row,
      retrieval_score: Math.min(0.89, 0.45 + scoreLexicalChunk(row, keywords) / 1000),
      score_type: 'lexical' as const,
      source_type: row.source_type,
    }))
    .sort((left, right) => (right.retrieval_score ?? 0) - (left.retrieval_score ?? 0))

  let vectorRows: KnowledgeSourceChunkSearchRow[] = []

  try {
    const vector = await embedText384(query)
    if (vector?.length) {
      const { data: vectorData, error: vectorError } = await supabase.rpc('match_knowledge_chunks_384', {
        p_clinic_id: clinicId,
        p_query_embedding: serializePgVector(vector),
        p_match_count: Math.max((options?.limit ?? 5) * 2, 8),
        p_match_threshold: 0.72,
      })

      if (vectorError) throw vectorError

      vectorRows = ((vectorData ?? []) as any[]).map((row) => ({
        ...row,
        knowledge_sources: row.knowledge_sources,
      }))
    }
  } catch (error) {
    console.warn('Vector retrieval failed, falling back to lexical search:', error)
  }

  return mergeHybridKnowledgeResults(
    lexicalRows,
    vectorRows,
    options?.limit ?? 5,
  )
}
