import { NextResponse } from 'next/server'
import {
  getLemonSqueezyPayloadHash,
  getLemonSqueezyWebhookEventName,
  getLemonSqueezyWebhookSecret,
  isDuplicateWebhookEventError,
  markWebhookEventStatus,
  recordLemonSqueezyWebhookEvent,
  syncClinicBillingFromLemonSqueezyWebhook,
  verifyLemonSqueezyWebhookSignature,
  type LemonSqueezyWebhookPayload,
} from '@/lib/billing/lemonsqueezy-server'
import { safeErrorLog } from '@/lib/security'

function buildResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature')
  const webhookSecret = getLemonSqueezyWebhookSecret()

  if (!webhookSecret) {
    console.error('[billing:lemonsqueezy:webhook] Missing Lemon Squeezy webhook secret')
    return buildResponse({ error: 'Webhook is not configured.' }, 500)
  }

  if (!verifyLemonSqueezyWebhookSignature({ rawBody, signature, secret: webhookSecret })) {
    console.warn('[billing:lemonsqueezy:webhook] Invalid webhook signature', {
      hasSignature: Boolean(signature),
    })
    return buildResponse({ error: 'Invalid signature.' }, 401)
  }

  let payload: LemonSqueezyWebhookPayload
  try {
    payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload
  } catch (error) {
    console.warn('[billing:lemonsqueezy:webhook] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error),
    })
    return buildResponse({ error: 'Invalid JSON payload.' }, 400)
  }

  const eventName = getLemonSqueezyWebhookEventName(request.headers, payload)
  const payloadHash = getLemonSqueezyPayloadHash(rawBody)

  let webhookEvent
  try {
    webhookEvent = await recordLemonSqueezyWebhookEvent({
      eventName,
      payloadHash,
      payload,
    })
  } catch (error) {
    if (isDuplicateWebhookEventError(error)) {
      return buildResponse({ ok: true, duplicate: true })
    }

    safeErrorLog('billing:lemonsqueezy:webhook:record', error)
    return buildResponse({ error: 'Failed to record webhook event.' }, 500)
  }

  try {
    const result = await syncClinicBillingFromLemonSqueezyWebhook({
      payload,
      eventName,
    })

    await markWebhookEventStatus({
      webhookEventId: webhookEvent.id,
      status: result.status,
      errorMessage: result.reason ?? null,
    })

    return buildResponse({ ok: true, status: result.status })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await markWebhookEventStatus({
      webhookEventId: webhookEvent.id,
      status: 'failed',
      errorMessage,
    }).catch((statusError) => {
      safeErrorLog('billing:lemonsqueezy:webhook:mark-failed', statusError)
    })
    safeErrorLog('billing:lemonsqueezy:webhook:process', error)
    return buildResponse({ error: 'Failed to process webhook.' }, 500)
  }
}
