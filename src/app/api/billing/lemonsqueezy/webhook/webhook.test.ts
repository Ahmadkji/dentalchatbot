import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const duplicateWebhookError = new Error('duplicate webhook')

vi.mock('@/lib/billing/lemonsqueezy-server', () => ({
  getLemonSqueezyPayloadHash: vi.fn(() => 'payload-hash'),
  getLemonSqueezyWebhookEventName: vi.fn(() => 'subscription_created'),
  getLemonSqueezyWebhookSecret: vi.fn(() => 'webhook-secret'),
  isDuplicateWebhookEventError: vi.fn((error) => error === duplicateWebhookError),
  markWebhookEventStatus: vi.fn().mockResolvedValue(undefined),
  recordLemonSqueezyWebhookEvent: vi.fn().mockResolvedValue({ id: 'event-123' }),
  syncClinicBillingFromLemonSqueezyWebhook: vi.fn().mockResolvedValue({ status: 'processed' }),
  verifyLemonSqueezyWebhookSignature: vi.fn(() => true),
}))

vi.mock('@/lib/security', () => ({
  safeErrorLog: vi.fn(),
}))

import { POST } from '@/app/api/billing/lemonsqueezy/webhook/route'
import {
  getLemonSqueezyWebhookSecret,
  markWebhookEventStatus,
  recordLemonSqueezyWebhookEvent,
  syncClinicBillingFromLemonSqueezyWebhook,
  verifyLemonSqueezyWebhookSignature,
} from '@/lib/billing/lemonsqueezy-server'

function makeWebhookRequest(body: unknown) {
  return new Request('https://app.test/api/billing/lemonsqueezy/webhook', {
    method: 'POST',
    headers: {
      'x-signature': 'valid-signature',
      'x-event-name': 'subscription_created',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getLemonSqueezyWebhookSecret as ReturnType<typeof vi.fn>).mockReturnValue('webhook-secret')
  ;(verifyLemonSqueezyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true)
  ;(recordLemonSqueezyWebhookEvent as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'event-123' })
  ;(syncClinicBillingFromLemonSqueezyWebhook as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'processed' })
  ;(markWebhookEventStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
})

describe('POST /api/billing/lemonsqueezy/webhook', () => {
  it('rejects requests when the webhook secret is not configured', async () => {
    ;(getLemonSqueezyWebhookSecret as ReturnType<typeof vi.fn>).mockReturnValue(null)

    const response = await POST(makeWebhookRequest({ data: { id: 'sub-1', type: 'subscriptions' } }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Webhook is not configured.')
    expect(recordLemonSqueezyWebhookEvent).not.toHaveBeenCalled()
  })

  it('rejects requests with an invalid signature before parsing business data', async () => {
    ;(verifyLemonSqueezyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const response = await POST(makeWebhookRequest({ data: { id: 'sub-1', type: 'subscriptions' } }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Invalid signature.')
    expect(recordLemonSqueezyWebhookEvent).not.toHaveBeenCalled()
  })

  it('records, processes, and marks a valid webhook as processed', async () => {
    const payload = {
      meta: { event_name: 'subscription_created', custom_data: { clinic_id: 'clinic-1' } },
      data: { id: 'sub-1', type: 'subscriptions', attributes: { status: 'active' } },
    }

    const response = await POST(makeWebhookRequest(payload))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, status: 'processed' })
    expect(recordLemonSqueezyWebhookEvent).toHaveBeenCalledWith({
      eventName: 'subscription_created',
      payloadHash: 'payload-hash',
      payload,
    })
    expect(syncClinicBillingFromLemonSqueezyWebhook).toHaveBeenCalledWith({
      payload,
      eventName: 'subscription_created',
    })
    expect(markWebhookEventStatus).toHaveBeenCalledWith({
      webhookEventId: 'event-123',
      status: 'processed',
      errorMessage: null,
    })
  })

  it('acknowledges duplicate webhook deliveries without processing twice', async () => {
    ;(recordLemonSqueezyWebhookEvent as ReturnType<typeof vi.fn>).mockRejectedValue(duplicateWebhookError)

    const response = await POST(makeWebhookRequest({ data: { id: 'sub-1', type: 'subscriptions' } }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, duplicate: true })
    expect(syncClinicBillingFromLemonSqueezyWebhook).not.toHaveBeenCalled()
    expect(markWebhookEventStatus).not.toHaveBeenCalled()
  })
})
