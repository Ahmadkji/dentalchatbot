import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import { processQueuedHumanHandoffRequests } from '@/lib/human-handoff/runner'

export const maxDuration = 60

function getExpectedRunnerSecret() {
  return process.env.HUMAN_HANDOFF_RUNNER_SECRET?.trim() || null
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
    request.headers.get('x-human-handoff-runner-secret')?.trim() ||
    readBearerToken(request)

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'Human handoff runner secret is not configured.' },
      { status: 503 },
    )
  }

  if (!candidateSecret || candidateSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getClientIp(request.headers)
  const rl = await enforceRateLimit({
    key: `internal-human-handoff:${ip}`,
    limit: 20,
    windowMs: 60 * 1000,
    failOpen: false,
  })
  if (rl) return rl

  try {
    const body = await request.json().catch(() => null)
    const limit = Number(body?.limit ?? 3)
    const runner = typeof body?.runner === 'string' && body.runner.trim() ? body.runner.trim() : 'internal-route'
    const result = await processQueuedHumanHandoffRequests({ limit, runner })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[internal:human-handoff] Failed to process queued human handoff requests', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to process queued human handoff requests' }, { status: 500 })
  }
}
