import { NextRequest, NextResponse } from 'next/server'
import {
  isValidKnowledgeRunnerSecret,
  normalizeKnowledgeJobLimit,
  processQueuedKnowledgeJobs,
} from '@/lib/knowledge/jobs'

export const maxDuration = 60

function getExpectedRunnerSecret() {
  return process.env.KNOWLEDGE_JOB_RUNNER_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}

function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')?.trim()
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

export async function POST(request: NextRequest) {
  const expectedSecret = getExpectedRunnerSecret()
  const candidateSecret =
    request.headers.get('x-knowledge-runner-secret')?.trim() ||
    readBearerToken(request)

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'Knowledge runner secret is not configured.' },
      { status: 503 },
    )
  }

  if (!isValidKnowledgeRunnerSecret(expectedSecret, candidateSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const limit = normalizeKnowledgeJobLimit(Number(body?.limit ?? 2))
    const runner = typeof body?.runner === 'string' && body.runner.trim() ? body.runner.trim() : 'internal-route'
    const result = await processQueuedKnowledgeJobs({ limit, runner })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing queued knowledge jobs:', error)
    return NextResponse.json({ error: 'Failed to process queued jobs' }, { status: 500 })
  }
}
