import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/env/server', () => ({
  serverEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    NEXT_PUBLIC_SITE_URL: 'https://app.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    WIDGET_ACCESS_TOKEN_SECRET: 'x'.repeat(32),
    OPENROUTER_API_KEY: 'openrouter-key',
    OPENROUTER_MODEL: 'test-model',
    LEMONSQUEEZY_API_KEY: 'lemon-api-key',
    LEMONSQUEEZY_STORE_ID: 'store-123',
    LEMONSQUEEZY_DEFAULT_VARIANT_ID: 'variant-123',
    LEMONSQUEEZY_WEBHOOK_SECRET: 'webhook-secret',
    LEMONSQUEEZY_TEST_MODE: 'false',
  },
}))

vi.mock('@/lib/site-url', () => ({
  getSiteUrl: () => 'https://app.test',
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

import {
  createLemonSqueezyCheckout,
  getLemonSqueezyPayloadHash,
  getLemonSqueezyWebhookEventName,
  verifyLemonSqueezyWebhookSignature,
} from '@/lib/billing/lemonsqueezy-server'

describe('Lemon Squeezy billing server helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('verifies webhook signatures with HMAC SHA-256', () => {
    const rawBody = JSON.stringify({ data: { id: 'sub-1', type: 'subscriptions' } })
    const secret = 'webhook-secret'
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    expect(verifyLemonSqueezyWebhookSignature({ rawBody, signature, secret })).toBe(true)
    expect(verifyLemonSqueezyWebhookSignature({ rawBody, signature: 'bad-signature', secret })).toBe(false)
    expect(verifyLemonSqueezyWebhookSignature({ rawBody, signature: null, secret })).toBe(false)
  })

  it('hashes payloads consistently for duplicate webhook detection', () => {
    const rawBody = '{"meta":{"event_name":"subscription_created"}}'
    const expected = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex')

    expect(getLemonSqueezyPayloadHash(rawBody)).toBe(expected)
  })

  it('prefers x-event-name over payload meta event name', () => {
    const headers = new Headers({ 'x-event-name': 'subscription_updated' })

    expect(
      getLemonSqueezyWebhookEventName(headers, {
        meta: { event_name: 'subscription_created' },
      }),
    ).toBe('subscription_updated')
  })

  it('creates checkout requests with store, variant, redirect, and custom clinic data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'checkout-123',
            type: 'checkouts',
            attributes: {
              url: 'https://checkout.lemonsqueezy.com/buy/test',
              expires_at: '2026-06-07T13:00:00.000Z',
            },
          },
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLemonSqueezyCheckout({
      checkoutSessionId: 'session-123',
      clinicId: 'clinic-123',
      userId: 'user-123',
      userEmail: 'owner@example.com',
      userName: 'Owner User',
      variantId: 'variant-456',
      testMode: false,
      expiresAt: '2026-06-07T13:00:00.000Z',
    })

    expect(result.checkoutId).toBe('checkout-123')
    expect(result.checkoutUrl).toBe('https://checkout.lemonsqueezy.com/buy/test')
    expect(fetchMock).toHaveBeenCalledOnce()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.lemonsqueezy.com/v1/checkouts')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer lemon-api-key')

    const body = JSON.parse(String(init.body))
    expect(body.data.relationships.store.data.id).toBe('store-123')
    expect(body.data.relationships.variant.data.id).toBe('variant-456')
    expect(body.data.attributes.product_options.redirect_url).toBe('https://app.test/dashboard/billing?billing=success')
    expect(body.data.attributes.checkout_data.email).toBe('owner@example.com')
    expect(body.data.attributes.checkout_data.custom).toEqual({
      clinic_id: 'clinic-123',
      user_id: 'user-123',
      user_email: 'owner@example.com',
      checkout_session_id: 'session-123',
    })
  })
})
