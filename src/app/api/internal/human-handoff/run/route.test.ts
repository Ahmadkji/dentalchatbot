import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit-guard', () => ({
  enforceRateLimit: vi.fn(),
}))
vi.mock('@/lib/security', () => ({
  getClientIp: vi.fn(),
}))
vi.mock('@/lib/human-handoff/runner', () => ({
  processQueuedHumanHandoffRequests: vi.fn(),
}))

import { POST } from '@/app/api/internal/human-handoff/run/route'
import { enforceRateLimit } from '@/lib/rate-limit-guard'
import { getClientIp } from '@/lib/security'
import { processQueuedHumanHandoffRequests } from '@/lib/human-handoff/runner'

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('https://app.example.com/api/internal/human-handoff/run', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/internal/human-handoff/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getClientIp as ReturnType<typeof vi.fn>).mockReturnValue('203.0.113.10')
    ;(enforceRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    process.env.HUMAN_HANDOFF_RUNNER_SECRET = 'runner-secret'
  })

  it('rejects requests without the configured secret', async () => {
    const response = await POST(makeRequest({ limit: 1 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
    expect(processQueuedHumanHandoffRequests).not.toHaveBeenCalled()
  })

  it('delegates queued human handoff processing when authorized', async () => {
    ;(processQueuedHumanHandoffRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
      queued: 1,
      delivered: 1,
      failed: 0,
    })

    const response = await POST(
      makeRequest({ limit: 2, runner: 'test-runner' }, { authorization: 'Bearer runner-secret' }),
    )

    expect(response.status).toBe(200)
    expect(processQueuedHumanHandoffRequests).toHaveBeenCalledWith({
      limit: 2,
      runner: 'test-runner',
    })
    await expect(response.json()).resolves.toMatchObject({
      queued: 1,
      delivered: 1,
      failed: 0,
    })
  })
})
