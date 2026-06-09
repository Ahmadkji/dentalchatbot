import 'server-only'

import crypto from 'node:crypto'
import { serverEnv } from '@/lib/env/server'
import { getSiteUrl } from '@/lib/site-url'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getClinicBillingFeatures,
  type ClinicBillingFeatures,
  type ClinicBillingPlanState,
} from '@/lib/billing/feature-gates'

const LEMON_SQUEEZY_API_BASE_URL = 'https://api.lemonsqueezy.com/v1'
const BILLING_CHECKOUT_SESSION_TTL_MS = 60 * 60 * 1000
const LEMON_SQUEEZY_PROVIDER = 'lemonsqueezy'

type JsonRecord = Record<string, unknown>

export type ClinicBillingSubscriptionRow = {
  clinic_id: string
  owner_user_id: string | null
  user_email: string | null
  provider: 'lemonsqueezy'
  status: ClinicBillingPlanState
  provider_status: string | null
  lemon_customer_id: string | null
  lemon_order_id: string | null
  lemon_order_item_id: string | null
  lemon_subscription_id: string | null
  lemon_product_id: string | null
  lemon_variant_id: string | null
  lemon_product_name: string | null
  lemon_variant_name: string | null
  billing_cycle: string | null
  currency: string | null
  amount_cents: number | null
  renews_at: string | null
  ends_at: string | null
  trial_ends_at: string | null
  is_canceled: boolean
  test_mode: boolean
  customer_portal_url: string | null
  update_payment_method_url: string | null
  last_event_type: string | null
  last_event_id: string | null
  last_synced_at: string
  created_at: string
  updated_at: string
}

export type ClinicBillingCheckoutSessionRow = {
  id: string
  clinic_id: string
  user_id: string
  user_email: string
  provider: 'lemonsqueezy'
  target_variant_id: string
  test_mode: boolean
  status: 'pending' | 'checkout_created' | 'processed' | 'expired' | 'failed'
  lemon_checkout_id: string | null
  checkout_url: string | null
  expires_at: string
  processed_at: string | null
  failed_at: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export type ClinicBillingWebhookEventRow = {
  id: string
  provider: 'lemonsqueezy'
  event_name: string
  event_key: string | null
  payload_sha256: string
  payload: JsonRecord
  status: 'received' | 'processed' | 'duplicate' | 'ignored' | 'failed'
  processed_at: string | null
  error_message: string | null
  created_at: string
}

export type ClinicBillingStatus = {
  state: ClinicBillingPlanState
  providerStatus: string | null
  isActive: boolean
  features: ClinicBillingFeatures
  ownerUserId: string | null
  userEmail: string | null
  variantId: string | null
  productId: string | null
  subscriptionId: string | null
  customerId: string | null
  renewsAt: string | null
  endsAt: string | null
  trialEndsAt: string | null
  billingCycle: string | null
  currency: string | null
  amountCents: number | null
  isCanceled: boolean
  testMode: boolean
  customerPortalUrl: string | null
  updatePaymentMethodUrl: string | null
  lastEventType: string | null
  lastEventId: string | null
  lastSyncedAt: string | null
}

type LemonSqueezyResource<TAttributes extends JsonRecord = JsonRecord> = {
  id?: string | number
  type?: string
  attributes?: TAttributes
}

type LemonSqueezyApiResponse<TAttributes extends JsonRecord = JsonRecord> = {
  data?: LemonSqueezyResource<TAttributes>
  errors?: unknown
}

type LemonSqueezyCheckoutAttributes = {
  url?: string
  expires_at?: string | null
  test_mode?: boolean
}

export type LemonSqueezyWebhookPayload = {
  meta?: {
    event_name?: string
    custom_data?: JsonRecord
    webhook_id?: string | number | null
    event_id?: string | number | null
  }
  data?: LemonSqueezyResource
}

type LemonSqueezySyncResult = {
  status: 'processed' | 'ignored'
  reason?: string
}

class DuplicateWebhookEventError extends Error {
  constructor() {
    super('Duplicate Lemon Squeezy webhook event.')
    this.name = 'DuplicateWebhookEventError'
  }
}

export class CheckoutSessionAlreadyExistsError extends Error {
  constructor() {
    super('A checkout session is already being created.')
    this.name = 'CheckoutSessionAlreadyExistsError'
  }
}

function logBilling(level: 'info' | 'warn' | 'error', message: string, details: Record<string, unknown>) {
  const payload = { source: 'lemonsqueezy-billing', ...details }

  if (level === 'error') {
    console.error(`[billing] ${message}`, payload)
    return
  }

  if (level === 'warn') {
    console.warn(`[billing] ${message}`, payload)
    return
  }

  console.info(`[billing] ${message}`, payload)
}

function getLemonSqueezyApiKey() {
  return serverEnv.LEMONSQUEEZY_API_KEY?.trim() || null
}

function getLemonSqueezyStoreId() {
  return serverEnv.LEMONSQUEEZY_STORE_ID?.trim() || null
}

export function getLemonSqueezyDefaultVariantId() {
  return serverEnv.LEMONSQUEEZY_DEFAULT_VARIANT_ID?.trim() || null
}

export function getLemonSqueezyWebhookSecret() {
  return serverEnv.LEMONSQUEEZY_WEBHOOK_SECRET?.trim() || null
}

export function isLemonSqueezyCheckoutConfigured() {
  return Boolean(
    getLemonSqueezyApiKey() &&
      getLemonSqueezyStoreId() &&
      getLemonSqueezyDefaultVariantId(),
  )
}

export function isLemonSqueezyTestModeEnabled() {
  return serverEnv.LEMONSQUEEZY_TEST_MODE === 'true'
}

export function getBillingDashboardUrl() {
  return `${getSiteUrl()}/dashboard/billing`
}

export function getLemonSqueezyWebhookUrl() {
  return `${getSiteUrl()}/api/billing/lemonsqueezy/webhook`
}

export function getBillingCheckoutSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + BILLING_CHECKOUT_SESSION_TTL_MS).toISOString()
}

function requireLemonSqueezyApiConfig() {
  const apiKey = getLemonSqueezyApiKey()
  const storeId = getLemonSqueezyStoreId()

  if (!apiKey || !storeId) {
    throw new Error(
      'Lemon Squeezy billing is not configured. Set LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID.',
    )
  }

  return { apiKey, storeId }
}

function parseNullableDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toIsoDate(value: Date | null) {
  return value ? value.toISOString() : null
}

function stringOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function booleanOrFalse(value: unknown) {
  return value === true
}

function integerOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }
  return null
}

function getNestedRecord(parent: JsonRecord | undefined, key: string): JsonRecord | null {
  const value = parent?.[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

function getStringFromRecord(record: JsonRecord | null | undefined, key: string) {
  return stringOrNull(record?.[key])
}

function getAmountCents(attributes: JsonRecord) {
  return (
    integerOrNull(attributes.total) ??
    integerOrNull(attributes.subtotal) ??
    integerOrNull(attributes.renewal_amount) ??
    integerOrNull(attributes.unit_price) ??
    integerOrNull(attributes.price)
  )
}

function getBillingCycle(attributes: JsonRecord) {
  const firstSubscriptionItem = getNestedRecord(attributes, 'first_subscription_item')
  return (
    getStringFromRecord(firstSubscriptionItem, 'interval') ??
    getStringFromRecord(attributes, 'interval') ??
    getStringFromRecord(attributes, 'billing_interval')
  )
}

function getPlanStateFromLemonSqueezy(input: {
  providerStatus: string | null
  trialEndsAt: Date | null
  endsAt: Date | null
  isCanceled: boolean
}): ClinicBillingPlanState {
  const providerStatus = input.providerStatus?.toLowerCase() ?? null
  const now = new Date()

  if (input.endsAt && input.endsAt.getTime() <= now.getTime()) {
    return 'expired'
  }

  if (providerStatus === 'expired') {
    return 'expired'
  }

  if (input.trialEndsAt && input.trialEndsAt.getTime() > now.getTime()) {
    return 'trial'
  }

  if (providerStatus === 'on_trial') {
    return 'trial'
  }

  if (providerStatus === 'cancelled' || providerStatus === 'canceled' || input.isCanceled) {
    return 'canceled'
  }

  if (
    providerStatus === 'active' ||
    providerStatus === 'past_due' ||
    providerStatus === 'unpaid' ||
    providerStatus === 'paused'
  ) {
    return 'active'
  }

  return 'pending'
}

function isBillingActive(state: ClinicBillingPlanState, endsAt: Date | null, trialEndsAt: Date | null) {
  const now = new Date()
  const activeUntil = endsAt ?? trialEndsAt

  if (activeUntil && activeUntil.getTime() <= now.getTime()) {
    return false
  }

  return state === 'trial' || state === 'active' || state === 'canceled'
}

async function lemonSqueezyFetch<TAttributes extends JsonRecord>(
  path: string,
  init: RequestInit,
): Promise<LemonSqueezyApiResponse<TAttributes>> {
  const { apiKey } = requireLemonSqueezyApiConfig()
  const response = await fetch(`${LEMON_SQUEEZY_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  })

  const responseText = await response.text()
  const payload = responseText ? JSON.parse(responseText) : {}

  if (!response.ok) {
    logBilling('error', 'Lemon Squeezy API request failed.', {
      path,
      status: response.status,
      body: payload,
    })
    throw new Error(`Lemon Squeezy API request failed with status ${response.status}.`)
  }

  return payload as LemonSqueezyApiResponse<TAttributes>
}

export async function createLemonSqueezyCheckout(input: {
  checkoutSessionId: string
  clinicId: string
  userId: string
  userEmail: string
  userName?: string | null
  variantId: string
  testMode: boolean
  expiresAt: string
}) {
  const { storeId } = requireLemonSqueezyApiConfig()
  const response = await lemonSqueezyFetch<LemonSqueezyCheckoutAttributes>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: input.userEmail,
            name: input.userName ?? undefined,
            custom: {
              clinic_id: input.clinicId,
              user_id: input.userId,
              user_email: input.userEmail,
              checkout_session_id: input.checkoutSessionId,
            },
          },
          product_options: {
            redirect_url: `${getBillingDashboardUrl()}?billing=success`,
          },
          expires_at: input.expiresAt,
          test_mode: input.testMode,
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: storeId,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: input.variantId,
            },
          },
        },
      },
    }),
  })

  const checkoutId = stringOrNull(response.data?.id)
  const checkoutUrl = stringOrNull(response.data?.attributes?.url)

  if (!checkoutId || !checkoutUrl) {
    logBilling('error', 'Lemon Squeezy checkout response was missing required fields.', {
      checkoutSessionId: input.checkoutSessionId,
      hasCheckoutId: Boolean(checkoutId),
      hasCheckoutUrl: Boolean(checkoutUrl),
    })
    throw new Error('Lemon Squeezy checkout response was missing a URL.')
  }

  return {
    checkoutId,
    checkoutUrl,
    expiresAt: stringOrNull(response.data?.attributes?.expires_at) ?? input.expiresAt,
  }
}

export async function getClinicBillingStatus(clinicId: string): Promise<ClinicBillingStatus> {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_subscriptions')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (error) {
    logBilling('error', 'Failed to load clinic billing status.', {
      clinicId,
      error: error.message,
    })
    throw error
  }

  const row = (data as ClinicBillingSubscriptionRow | null) ?? null
  const endsAt = row?.ends_at ? new Date(row.ends_at) : null
  const trialEndsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null
  const state = row?.status ?? 'free'
  const isActive = isBillingActive(state, endsAt, trialEndsAt)
  const features = getClinicBillingFeatures({ state, isActive })

  return {
    state,
    providerStatus: row?.provider_status ?? null,
    isActive,
    features,
    ownerUserId: row?.owner_user_id ?? null,
    userEmail: row?.user_email ?? null,
    variantId: row?.lemon_variant_id ?? null,
    productId: row?.lemon_product_id ?? null,
    subscriptionId: row?.lemon_subscription_id ?? null,
    customerId: row?.lemon_customer_id ?? null,
    renewsAt: row?.renews_at ?? null,
    endsAt: row?.ends_at ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
    billingCycle: row?.billing_cycle ?? null,
    currency: row?.currency ?? null,
    amountCents: row?.amount_cents ?? null,
    isCanceled: row?.is_canceled ?? false,
    testMode: row?.test_mode ?? false,
    customerPortalUrl: row?.customer_portal_url ?? null,
    updatePaymentMethodUrl: row?.update_payment_method_url ?? null,
    lastEventType: row?.last_event_type ?? null,
    lastEventId: row?.last_event_id ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
  }
}

export async function expireStaleCheckoutSessions(input: {
  clinicId: string
  userId: string
  variantId: string
  testMode: boolean
}) {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .update({ status: 'expired' })
    .eq('clinic_id', input.clinicId)
    .eq('user_id', input.userId)
    .eq('target_variant_id', input.variantId)
    .eq('test_mode', input.testMode)
    .in('status', ['pending', 'checkout_created'])
    .lte('expires_at', new Date().toISOString())

  if (error) {
    logBilling('error', 'Failed to expire stale checkout sessions.', {
      clinicId: input.clinicId,
      userId: input.userId,
      variantId: input.variantId,
      error: error.message,
    })
    throw error
  }
}

export async function findReusableCheckoutSession(input: {
  clinicId: string
  userId: string
  variantId: string
  testMode: boolean
}) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .select('*')
    .eq('clinic_id', input.clinicId)
    .eq('user_id', input.userId)
    .eq('target_variant_id', input.variantId)
    .eq('test_mode', input.testMode)
    .eq('status', 'checkout_created')
    .gt('expires_at', new Date().toISOString())
    .not('checkout_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logBilling('error', 'Failed to load reusable checkout session.', {
      clinicId: input.clinicId,
      userId: input.userId,
      variantId: input.variantId,
      error: error.message,
    })
    throw error
  }

  return (data as ClinicBillingCheckoutSessionRow | null) ?? null
}

export async function findPendingCheckoutSession(input: {
  clinicId: string
  userId: string
  variantId: string
  testMode: boolean
}) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .select('*')
    .eq('clinic_id', input.clinicId)
    .eq('user_id', input.userId)
    .eq('target_variant_id', input.variantId)
    .eq('test_mode', input.testMode)
    .in('status', ['pending', 'checkout_created'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logBilling('error', 'Failed to load pending checkout session.', {
      clinicId: input.clinicId,
      userId: input.userId,
      variantId: input.variantId,
      error: error.message,
    })
    throw error
  }

  return (data as ClinicBillingCheckoutSessionRow | null) ?? null
}

export async function createPendingCheckoutSession(input: {
  clinicId: string
  userId: string
  userEmail: string
  variantId: string
  testMode: boolean
  expiresAt?: string
}) {
  const expiresAt = input.expiresAt ?? getBillingCheckoutSessionExpiresAt()
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .insert({
      clinic_id: input.clinicId,
      user_id: input.userId,
      user_email: input.userEmail,
      target_variant_id: input.variantId,
      test_mode: input.testMode,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*')
    .single()

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === '23505') {
      logBilling('warn', 'Checkout session already exists for this user and variant.', {
        clinicId: input.clinicId,
        userId: input.userId,
        variantId: input.variantId,
        testMode: input.testMode,
      })
      throw new CheckoutSessionAlreadyExistsError()
    }

    logBilling('error', 'Failed to create pending checkout session.', {
      clinicId: input.clinicId,
      userId: input.userId,
      userEmail: input.userEmail,
      variantId: input.variantId,
      error: error?.message ?? 'Unknown error',
    })
    throw error ?? new Error('Failed to create pending checkout session.')
  }

  logBilling('info', 'Created pending checkout session.', {
    clinicId: input.clinicId,
    userId: input.userId,
    checkoutSessionId: data.id,
    variantId: input.variantId,
    testMode: input.testMode,
    expiresAt,
  })

  return data as ClinicBillingCheckoutSessionRow
}

export async function markCheckoutSessionCreated(input: {
  checkoutSessionId: string
  lemonCheckoutId: string
  checkoutUrl: string
  expiresAt: string
}) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .update({
      status: 'checkout_created',
      lemon_checkout_id: input.lemonCheckoutId,
      checkout_url: input.checkoutUrl,
      expires_at: input.expiresAt,
    })
    .eq('id', input.checkoutSessionId)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (error || !data) {
    logBilling('error', 'Failed to mark checkout session as created.', {
      checkoutSessionId: input.checkoutSessionId,
      lemonCheckoutId: input.lemonCheckoutId,
      error: error?.message ?? 'Unknown error',
    })
    throw error ?? new Error('Failed to mark checkout session as created.')
  }

  return data as ClinicBillingCheckoutSessionRow
}

export async function markCheckoutSessionFailed(input: {
  checkoutSessionId: string
  reason: string
}) {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: input.reason.slice(0, 500),
    })
    .eq('id', input.checkoutSessionId)
    .eq('status', 'pending')

  if (error) {
    logBilling('error', 'Failed to mark checkout session as failed.', {
      checkoutSessionId: input.checkoutSessionId,
      error: error.message,
    })
  }
}

export async function markCheckoutSessionProcessed(checkoutSessionId: string) {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('clinic_billing_checkout_sessions')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', checkoutSessionId)
    .in('status', ['pending', 'checkout_created'])

  if (error) {
    logBilling('error', 'Failed to mark checkout session as processed.', {
      checkoutSessionId,
      error: error.message,
    })
    throw error
  }
}

export function getLemonSqueezyPayloadHash(rawBody: string) {
  return crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

export function verifyLemonSqueezyWebhookSignature(input: {
  rawBody: string
  signature: string | null
  secret: string
}) {
  const signature = input.signature?.trim() ?? ''
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false
  }

  const expectedHex = crypto
    .createHmac('sha256', input.secret)
    .update(input.rawBody)
    .digest('hex')

  const received = Buffer.from(signature, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')

  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}

export function getLemonSqueezyWebhookEventName(headers: Headers, payload: LemonSqueezyWebhookPayload) {
  return headers.get('x-event-name')?.trim() || stringOrNull(payload.meta?.event_name) || 'unknown'
}

function getWebhookEventId(payload: LemonSqueezyWebhookPayload) {
  return (
    stringOrNull(payload.meta?.webhook_id) ??
    stringOrNull(payload.meta?.event_id) ??
    null
  )
}

function getWebhookEventKey(eventName: string, payload: LemonSqueezyWebhookPayload) {
  const resourceType = stringOrNull(payload.data?.type) ?? 'unknown'
  const resourceId = stringOrNull(payload.data?.id) ?? 'unknown'
  const updatedAt = stringOrNull(payload.data?.attributes?.updated_at) ?? stringOrNull(payload.data?.attributes?.created_at) ?? 'unknown'
  return `${eventName}:${resourceType}:${resourceId}:${updatedAt}`
}

export async function recordLemonSqueezyWebhookEvent(input: {
  eventName: string
  payloadHash: string
  payload: LemonSqueezyWebhookPayload
}) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_webhook_events')
    .insert({
      provider: LEMON_SQUEEZY_PROVIDER,
      event_name: input.eventName,
      event_key: getWebhookEventKey(input.eventName, input.payload),
      payload_sha256: input.payloadHash,
      payload: input.payload as JsonRecord,
      status: 'received',
    })
    .select('*')
    .single()

  if (error || !data) {
    if ((error as { code?: string } | null)?.code === '23505') {
      logBilling('info', 'Duplicate Lemon Squeezy webhook ignored.', {
        eventName: input.eventName,
        payloadHash: input.payloadHash,
      })
      throw new DuplicateWebhookEventError()
    }

    logBilling('error', 'Failed to record Lemon Squeezy webhook event.', {
      eventName: input.eventName,
      payloadHash: input.payloadHash,
      error: error?.message ?? 'Unknown error',
    })
    throw error ?? new Error('Failed to record Lemon Squeezy webhook event.')
  }

  return data as ClinicBillingWebhookEventRow
}

export function isDuplicateWebhookEventError(error: unknown) {
  return error instanceof DuplicateWebhookEventError
}

export async function markWebhookEventStatus(input: {
  webhookEventId: string
  status: 'processed' | 'ignored' | 'failed'
  errorMessage?: string | null
}) {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('clinic_billing_webhook_events')
    .update({
      status: input.status,
      processed_at: new Date().toISOString(),
      error_message: input.errorMessage ? input.errorMessage.slice(0, 500) : null,
    })
    .eq('id', input.webhookEventId)

  if (error) {
    logBilling('error', 'Failed to update webhook event status.', {
      webhookEventId: input.webhookEventId,
      status: input.status,
      error: error.message,
    })
    throw error
  }
}

async function findClinicBillingBySubscriptionId(subscriptionId: string) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_subscriptions')
    .select('*')
    .eq('lemon_subscription_id', subscriptionId)
    .maybeSingle()

  if (error) {
    logBilling('error', 'Failed to load billing row by Lemon Squeezy subscription id.', {
      subscriptionId,
      error: error.message,
    })
    throw error
  }

  return (data as ClinicBillingSubscriptionRow | null) ?? null
}

function mapLemonSqueezySubscriptionToBillingRow(input: {
  clinicId: string
  ownerUserId: string | null
  fallbackUserEmail: string | null
  eventName: string
  eventId: string | null
  resource: LemonSqueezyResource
}) {
  const attributes = input.resource.attributes ?? {}
  const urls = getNestedRecord(attributes, 'urls')
  const providerStatus = getStringFromRecord(attributes, 'status')
  const trialEndsAt = parseNullableDate(attributes.trial_ends_at)
  const endsAt = parseNullableDate(attributes.ends_at)
  const renewsAt = parseNullableDate(attributes.renews_at)
  const isCanceled = booleanOrFalse(attributes.cancelled) || providerStatus === 'cancelled'
  const state = getPlanStateFromLemonSqueezy({
    providerStatus,
    trialEndsAt,
    endsAt,
    isCanceled,
  })

  return {
    clinic_id: input.clinicId,
    owner_user_id: input.ownerUserId,
    user_email: input.fallbackUserEmail ?? getStringFromRecord(attributes, 'user_email'),
    provider: LEMON_SQUEEZY_PROVIDER,
    status: state,
    provider_status: providerStatus,
    lemon_customer_id: getStringFromRecord(attributes, 'customer_id'),
    lemon_order_id: getStringFromRecord(attributes, 'order_id'),
    lemon_order_item_id: getStringFromRecord(attributes, 'order_item_id'),
    lemon_subscription_id: stringOrNull(input.resource.id),
    lemon_product_id: getStringFromRecord(attributes, 'product_id'),
    lemon_variant_id: getStringFromRecord(attributes, 'variant_id'),
    lemon_product_name: getStringFromRecord(attributes, 'product_name'),
    lemon_variant_name: getStringFromRecord(attributes, 'variant_name'),
    billing_cycle: getBillingCycle(attributes),
    currency: getStringFromRecord(attributes, 'currency')?.toUpperCase() ?? null,
    amount_cents: getAmountCents(attributes),
    renews_at: toIsoDate(renewsAt),
    ends_at: toIsoDate(endsAt),
    trial_ends_at: toIsoDate(trialEndsAt),
    is_canceled: isCanceled,
    test_mode: booleanOrFalse(attributes.test_mode),
    customer_portal_url: getStringFromRecord(urls, 'customer_portal'),
    update_payment_method_url: getStringFromRecord(urls, 'update_payment_method'),
    last_event_type: input.eventName,
    last_event_id: input.eventId,
    last_synced_at: new Date().toISOString(),
  }
}

async function upsertClinicBillingSubscription(row: ReturnType<typeof mapLemonSqueezySubscriptionToBillingRow>) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_subscriptions')
    .upsert(row, { onConflict: 'clinic_id' })
    .select('*')
    .single()

  if (error || !data) {
    logBilling('error', 'Failed to sync Lemon Squeezy billing row.', {
      clinicId: row.clinic_id,
      subscriptionId: row.lemon_subscription_id,
      providerStatus: row.provider_status,
      state: row.status,
      error: error?.message ?? 'Unknown error',
    })
    throw error ?? new Error('Failed to sync Lemon Squeezy billing row.')
  }

  logBilling('info', 'Synced Lemon Squeezy billing row.', {
    clinicId: row.clinic_id,
    subscriptionId: row.lemon_subscription_id,
    providerStatus: row.provider_status,
    state: row.status,
    lastEventType: row.last_event_type,
  })

  return data as ClinicBillingSubscriptionRow
}

function getCustomData(payload: LemonSqueezyWebhookPayload) {
  const customData = payload.meta?.custom_data
  if (!customData || typeof customData !== 'object' || Array.isArray(customData)) {
    return {}
  }
  return customData as JsonRecord
}

export async function syncClinicBillingFromLemonSqueezyWebhook(input: {
  payload: LemonSqueezyWebhookPayload
  eventName: string
}): Promise<LemonSqueezySyncResult> {
  const resource = input.payload.data
  const resourceType = stringOrNull(resource?.type)
  const resourceId = stringOrNull(resource?.id)
  const customData = getCustomData(input.payload)
  const checkoutSessionId = getStringFromRecord(customData, 'checkout_session_id')
  const eventId = getWebhookEventId(input.payload)

  if (!resourceType || !resourceId || !resource) {
    logBilling('warn', 'Ignoring Lemon Squeezy webhook with no resource.', {
      eventName: input.eventName,
    })
    return { status: 'ignored', reason: 'missing_resource' }
  }

  if (resourceType === 'orders') {
    if (checkoutSessionId) {
      await markCheckoutSessionProcessed(checkoutSessionId)
    }
    return { status: 'processed' }
  }

  if (resourceType !== 'subscriptions') {
    logBilling('info', 'Ignoring unsupported Lemon Squeezy webhook resource type.', {
      eventName: input.eventName,
      resourceType,
      resourceId,
    })
    return { status: 'ignored', reason: 'unsupported_resource_type' }
  }

  const existingBillingRow = await findClinicBillingBySubscriptionId(resourceId)
  const clinicId = getStringFromRecord(customData, 'clinic_id') ?? existingBillingRow?.clinic_id ?? null

  if (!clinicId) {
    logBilling('warn', 'Ignoring Lemon Squeezy subscription webhook with no clinic reference.', {
      eventName: input.eventName,
      subscriptionId: resourceId,
      hasCustomData: Object.keys(customData).length > 0,
    })
    return { status: 'ignored', reason: 'missing_clinic_reference' }
  }

  const row = mapLemonSqueezySubscriptionToBillingRow({
    clinicId,
    ownerUserId: getStringFromRecord(customData, 'user_id') ?? existingBillingRow?.owner_user_id ?? null,
    fallbackUserEmail: getStringFromRecord(customData, 'user_email') ?? existingBillingRow?.user_email ?? null,
    eventName: input.eventName,
    eventId,
    resource,
  })

  await upsertClinicBillingSubscription(row)

  if (checkoutSessionId) {
    await markCheckoutSessionProcessed(checkoutSessionId)
  }

  return { status: 'processed' }
}
