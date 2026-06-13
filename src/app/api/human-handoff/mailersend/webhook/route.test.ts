import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/human-handoff/mailersend-webhook', () => ({
  applyMailerSendWebhookEvent: vi.fn(),
  getMailerSendWebhookEventName: vi.fn(),
  getMailerSendWebhookMessageId: vi.fn(),
  getMailerSendWebhookSecret: vi.fn(),
  isMailerSendWebhookTestPayload: vi.fn(),
  verifyMailerSendWebhookSignature: vi.fn(),
}))

import { POST } from '@/app/api/human-handoff/mailersend/webhook/route'
import {
  applyMailerSendWebhookEvent,
  getMailerSendWebhookEventName,
  getMailerSendWebhookMessageId,
  getMailerSendWebhookSecret,
  isMailerSendWebhookTestPayload,
  verifyMailerSendWebhookSignature,
} from '@/lib/human-handoff/mailersend-webhook'

function makeRequest(body: Record<string, unknown>, signature = 'signed') {
  return new Request('https://app.example.com/api/human-handoff/mailersend/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      signature,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/human-handoff/mailersend/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getMailerSendWebhookSecret as ReturnType<typeof vi.fn>).mockReturnValue('webhook-secret')
    ;(verifyMailerSendWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(isMailerSendWebhookTestPayload as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;(getMailerSendWebhookEventName as ReturnType<typeof vi.fn>).mockReturnValue('activity.delivered')
    ;(getMailerSendWebhookMessageId as ReturnType<typeof vi.fn>).mockReturnValue('message-123')
    ;(applyMailerSendWebhookEvent as ReturnType<typeof vi.fn>).mockResolvedValue({
      updated: true,
      status: 'delivered',
    })
  })

  it('acknowledges MailerSend webhook test handshakes', async () => {
    ;(isMailerSendWebhookTestPayload as ReturnType<typeof vi.fn>).mockReturnValue(true)

    const response = await POST(makeRequest({ type: 'webhook.test' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, test: true })
    expect(applyMailerSendWebhookEvent).not.toHaveBeenCalled()
  })

  it('applies supported provider events', async () => {
    const response = await POST(
      makeRequest({
        type: 'activity.delivered',
        data: { message: { id: 'message-123' } },
      }),
    )

    expect(response.status).toBe(200)
    expect(applyMailerSendWebhookEvent).toHaveBeenCalledWith({
      eventName: 'activity.delivered',
      messageId: 'message-123',
    })
  })
})
