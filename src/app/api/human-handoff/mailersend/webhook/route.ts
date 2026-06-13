import { NextResponse } from 'next/server'
import {
  applyMailerSendWebhookEvent,
  getMailerSendWebhookEventName,
  getMailerSendWebhookMessageId,
  getMailerSendWebhookSecret,
  isMailerSendWebhookTestPayload,
  verifyMailerSendWebhookSignature,
  type MailerSendWebhookPayload,
} from '@/lib/human-handoff/mailersend-webhook'

function buildResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status })
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  let payload: MailerSendWebhookPayload
  try {
    payload = JSON.parse(rawBody) as MailerSendWebhookPayload
  } catch (error) {
    console.warn('[human-handoff:webhook] Invalid MailerSend webhook payload JSON', {
      error: error instanceof Error ? error.message : String(error),
    })
    return buildResponse({ error: 'Invalid JSON payload.' }, 400)
  }

  const webhookSecret = getMailerSendWebhookSecret(payload)
  if (!webhookSecret) {
    console.error('[human-handoff:webhook] MailerSend webhook signing secret is not configured', {
      eventName: getMailerSendWebhookEventName(payload) || 'unknown',
    })
    return buildResponse({ error: 'Webhook is not configured.' }, 500)
  }

  const signature = request.headers.get('signature')
  if (!verifyMailerSendWebhookSignature({ rawBody, signature, secret: webhookSecret })) {
    console.warn('[human-handoff:webhook] Invalid MailerSend webhook signature', {
      eventName: getMailerSendWebhookEventName(payload) || 'unknown',
      hasSignature: Boolean(signature),
    })
    return buildResponse({ error: 'Invalid signature.' }, 401)
  }

  if (isMailerSendWebhookTestPayload(payload)) {
    console.info('[human-handoff:webhook] MailerSend webhook test handshake received')
    return buildResponse({ ok: true, test: true })
  }

  const eventName = getMailerSendWebhookEventName(payload)
  const messageId = getMailerSendWebhookMessageId(payload)

  if (!eventName || !messageId) {
    console.warn('[human-handoff:webhook] MailerSend webhook payload is missing required fields', {
      eventName: eventName || null,
      messageId: messageId || null,
    })
    return buildResponse({ error: 'Missing event type or message id.' }, 400)
  }

  try {
    const result = await applyMailerSendWebhookEvent({ eventName, messageId })
    return buildResponse({ ok: true, result })
  } catch (error) {
    console.error('[human-handoff:webhook] Failed to apply MailerSend webhook event', {
      eventName,
      messageId,
      error: error instanceof Error ? error.message : String(error),
    })
    return buildResponse({ error: 'Failed to process webhook.' }, 500)
  }
}
