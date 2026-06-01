import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createKnowledgeSourceDraft, mapKnowledgeSource, getActiveKnowledgeSourceCount, MAX_KNOWLEDGE_SOURCES_PER_CLINIC } from '@/lib/knowledge/sources'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'

const KNOWLEDGE_BUCKET = 'clinic-knowledge'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024
const SUPPORTED_TYPES = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
])

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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
      key: `ks-upload-prepare:${current.clinic.id}:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
      failOpen: false,
    })
    if (rl) return rl

    const body = await request.json().catch(() => null)
    const rawFileName = String(body?.fileName ?? '').trim()
    const mimeType = String(body?.mimeType ?? '').trim()
    const fileSizeBytes = Number(body?.fileSizeBytes ?? 0)

    if (!rawFileName || !mimeType || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return NextResponse.json({ error: 'fileName, mimeType, and fileSizeBytes are required' }, { status: 400 })
    }

    if (fileSizeBytes > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max size is 10 MB.' }, { status: 400 })
    }

    const fileType = SUPPORTED_TYPES.get(mimeType)
    if (!fileType) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF or DOCX.' }, { status: 400 })
    }

    const fileName = sanitizeFileName(rawFileName)
    if (!fileName) {
      return NextResponse.json({ error: 'File name is invalid.' }, { status: 400 })
    }

    const activeCount = await getActiveKnowledgeSourceCount(supabase, current.clinic.id)
    if (activeCount >= MAX_KNOWLEDGE_SOURCES_PER_CLINIC) {
      return NextResponse.json(
        { error: `You have reached the maximum of ${MAX_KNOWLEDGE_SOURCES_PER_CLINIC} knowledge sources. Please delete some before uploading new files.` },
        { status: 429 },
      )
    }

    const source = await createKnowledgeSourceDraft(supabase, {
      clinicId: current.clinic.id,
      title: fileName,
      sourceType: 'file_upload',
      content: '',
      fileName,
      fileType: mimeType,
      createdBy: user.id,
      metadata: {
        originalFileName: rawFileName,
        uploadStrategy: fileSizeBytes > RESUMABLE_THRESHOLD ? 'resumable' : 'standard',
      },
      status: 'draft',
    })

    const storagePath = `${current.clinic.id}/${source.id}/original/${fileName}`
    const signedUpload = await supabase.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(storagePath)
    if (signedUpload.error || !signedUpload.data?.token) {
      throw signedUpload.error ?? new Error('Failed to prepare upload destination.')
    }

    return NextResponse.json({
      source: mapKnowledgeSource(source),
      upload: {
        bucketName: KNOWLEDGE_BUCKET,
        storagePath,
        token: signedUpload.data.token,
        strategy: fileSizeBytes > RESUMABLE_THRESHOLD ? 'resumable' : 'standard',
        fileName,
        fileType,
        mimeType,
        fileSizeBytes,
      },
    })
  } catch (error) {
    console.error('[knowledge-sources:upload-prepare] Failed to prepare knowledge upload', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare file upload' },
      { status: 500 },
    )
  }
}
