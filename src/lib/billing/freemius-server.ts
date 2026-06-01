import 'server-only'

import { Freemius } from '@freemius/sdk'
import { serverEnv } from '@/lib/env/server'
import { getSiteUrl } from '@/lib/site-url'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getClinicBillingFeatures,
  type ClinicBillingFeatures,
  type ClinicBillingPlanState,
} from '@/lib/billing/feature-gates'

export type ClinicFreemiusBillingRow = {
  clinic_id: string
  owner_user_id: string | null
  user_email: string | null
  status: ClinicBillingPlanState
  fs_user_id: string | null
  fs_license_id: string | null
  fs_plan_id: string | null
  fs_pricing_id: string | null
  fs_subscription_id: string | null
  billing_cycle: string | null
  currency: string | null
  quota: number | null
  amount: number | null
  expiration: string | null
  trial_ends_at: string | null
  is_canceled: boolean
  last_event_type: string | null
  last_event_id: string | null
  last_synced_at: string
  created_at: string
  updated_at: string
}

export type ClinicBillingCheckoutAttemptRow = {
  id: string
  clinic_id: string
  user_id: string
  user_email: string
  target_plan_id: string
  target_pricing_id: string | null
  trial_mode: 'free' | 'paid' | null
  is_sandbox: boolean
  checkout_url: string
  expires_at: string
  fs_license_id: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export type ClinicFreemiusBillingStatus = {
  state: ClinicBillingPlanState
  isActive: boolean
  features: ClinicBillingFeatures
  ownerUserId: string | null
  userEmail: string | null
  pricingId: string | null
  planId: string | null
  licenseId: string | null
  subscriptionId: string | null
  expiration: string | null
  trialEndsAt: string | null
  billingCycle: string | null
  currency: string | null
  amount: number | null
  isCanceled: boolean
  lastEventType: string | null
  lastEventId: string | null
  lastSyncedAt: string | null
}

type SyncClinicFreemiusBillingInput = {
  clinicId: string
  ownerUserId?: string | null
  userEmail?: string | null
  licenseId: string
  lastEventType?: string | null
  lastEventId?: string | null
}

type FreemiusSyncRecord = {
  license: Awaited<ReturnType<Freemius['api']['license']['retrieve']>>
  subscription: Awaited<ReturnType<Freemius['api']['license']['retrieveSubscription']>>
  user: Awaited<ReturnType<Freemius['api']['user']['retrieve']>>
}

let freemiusSingleton: Freemius | null = null
const BILLING_ATTEMPT_TTL_MS = 60 * 60 * 1000

function logBilling(level: 'info' | 'warn' | 'error', message: string, details: Record<string, unknown>) {
  const payload = { source: 'freemius-billing', ...details }

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

function getFreemiusClient() {
  if (!freemiusSingleton) {
    const productId = serverEnv.FREEMIUS_PRODUCT_ID
    const apiKey = serverEnv.FREEMIUS_API_KEY
    const secretKey = serverEnv.FREEMIUS_SECRET_KEY
    const publicKey = serverEnv.FREEMIUS_PUBLIC_KEY

    if (!productId || !apiKey || !secretKey || !publicKey) {
      throw new Error(
        'Freemius billing is not configured. Set FREEMIUS_PRODUCT_ID, FREEMIUS_API_KEY, FREEMIUS_SECRET_KEY, and FREEMIUS_PUBLIC_KEY env vars to enable billing.',
      )
    }

    freemiusSingleton = new Freemius({
      productId,
      apiKey,
      secretKey,
      publicKey,
    })
  }

  return freemiusSingleton
}

function parseIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

export function getBillingCheckoutAttemptExpiresAt(now = new Date()) {
  return new Date(now.getTime() + BILLING_ATTEMPT_TTL_MS).toISOString()
}

function getPlanState(input: {
  licenseExpiration: Date | null
  trialEndsAt: Date | null
  isCanceled: boolean
  hasSubscription: boolean
}) {
  const now = new Date()
  const activeUntil = input.licenseExpiration ?? input.trialEndsAt

  if (activeUntil && activeUntil.getTime() <= now.getTime()) {
    return 'expired' as const
  }

  if (input.trialEndsAt && input.trialEndsAt.getTime() > now.getTime()) {
    return 'trial' as const
  }

  if (input.isCanceled) {
    return 'canceled' as const
  }

  if (input.hasSubscription || input.licenseExpiration) {
    return 'active' as const
  }

  return 'free' as const
}

function isBillingActive(state: ClinicBillingPlanState, expiration: Date | null, trialEndsAt: Date | null) {
  const now = new Date()
  const activeUntil = expiration ?? trialEndsAt

  if (activeUntil && activeUntil.getTime() <= now.getTime()) {
    return false
  }

  return state === 'trial' || state === 'active' || state === 'canceled'
}

async function loadFreemiusSyncRecord(licenseId: string): Promise<FreemiusSyncRecord> {
  const freemius = getFreemiusClient()
  const license = await freemius.api.license.retrieve(licenseId)

  if (!license?.id) {
    throw new Error(`Freemius license ${licenseId} was not found.`)
  }

  const [subscription, user] = await Promise.all([
    freemius.api.license.retrieveSubscription(licenseId),
    license.user_id ? freemius.api.user.retrieve(license.user_id) : Promise.resolve(null),
  ])

  return { license, subscription, user }
}

function mapFreemiusRecordToBillingRow(input: {
  clinicId: string
  ownerUserId: string | null
  userEmail: string | null
  record: FreemiusSyncRecord
  lastEventType?: string | null
  lastEventId?: string | null
}) {
  const license = input.record.license
  if (!license) {
    throw new Error('Cannot map Freemius billing record: license is null.')
  }

  const licenseExpiration = license.expiration
    ? new Date(license.expiration)
    : null
  const trialEndsAt = input.record.subscription?.trial_ends
    ? new Date(input.record.subscription.trial_ends)
    : null
  const state = getPlanState({
    licenseExpiration,
    trialEndsAt,
    isCanceled: license.is_cancelled === true,
    hasSubscription: Boolean(input.record.subscription?.id),
  })

  return {
    clinic_id: input.clinicId,
    owner_user_id: input.ownerUserId,
    user_email: input.userEmail ?? input.record.user?.email ?? null,
    status: state,
    fs_user_id: license.user_id ? String(license.user_id) : null,
    fs_license_id: String(license.id),
    fs_plan_id: license.plan_id ? String(license.plan_id) : null,
    fs_pricing_id: license.pricing_id ? String(license.pricing_id) : null,
    fs_subscription_id: input.record.subscription?.id ? String(input.record.subscription.id) : null,
    billing_cycle: input.record.subscription?.billing_cycle
      ? String(input.record.subscription.billing_cycle)
      : null,
    currency: input.record.subscription?.currency
      ? String(input.record.subscription.currency).toUpperCase()
      : null,
    quota: typeof license.quota === 'number' ? license.quota : null,
    amount:
      typeof input.record.subscription?.renewal_amount === 'number'
        ? input.record.subscription.renewal_amount
        : typeof input.record.subscription?.initial_amount === 'number'
          ? input.record.subscription.initial_amount
          : null,
    expiration: parseIsoDate(licenseExpiration),
    trial_ends_at: parseIsoDate(trialEndsAt),
    is_canceled: license.is_cancelled === true,
    last_event_type: input.lastEventType ?? null,
    last_event_id: input.lastEventId ?? null,
    last_synced_at: new Date().toISOString(),
  }
}

export function getFreemiusReturnUrl() {
  return `${getSiteUrl()}/api/billing/freemius/return`
}

export function getFreemiusWidgetBillingUrl() {
  return `${getSiteUrl()}/dashboard/widget`
}

export function getFreemiusWebhookUrl() {
  return `${getSiteUrl()}/api/billing/freemius/webhook`
}

export function getFreemiusDefaultPlanId() {
  return serverEnv.FREEMIUS_DEFAULT_PLAN_ID ?? null
}

export function getFreemiusServerClient() {
  return getFreemiusClient()
}

export async function getClinicFreemiusBillingStatus(
  clinicId: string
): Promise<ClinicFreemiusBillingStatus> {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_freemius')
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

  const row = (data as ClinicFreemiusBillingRow | null) ?? null
  const expiration = row?.expiration ? new Date(row.expiration) : null
  const trialEndsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null
  const state = row?.status ?? 'free'
  const isActive = isBillingActive(state, expiration, trialEndsAt)
  const features = getClinicBillingFeatures({ state, isActive })

  return {
    state,
    isActive,
    features,
    ownerUserId: row?.owner_user_id ?? null,
    userEmail: row?.user_email ?? null,
    pricingId: row?.fs_pricing_id ?? null,
    planId: row?.fs_plan_id ?? null,
    licenseId: row?.fs_license_id ?? null,
    subscriptionId: row?.fs_subscription_id ?? null,
    expiration: row?.expiration ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
    billingCycle: row?.billing_cycle ?? null,
    currency: row?.currency ?? null,
    amount: row?.amount ?? null,
    isCanceled: row?.is_canceled ?? false,
    lastEventType: row?.last_event_type ?? null,
    lastEventId: row?.last_event_id ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
  }
}

export async function createClinicBillingCheckoutAttempt(input: {
  clinicId: string
  userId: string
  userEmail: string
  targetPlanId: string
  targetPricingId?: string | null
  trialMode?: 'free' | 'paid' | null
  isSandbox: boolean
  checkoutUrl: string
  expiresAt?: string
}) {
  const expiresAt = input.expiresAt ?? getBillingCheckoutAttemptExpiresAt()
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_attempts')
    .insert({
      clinic_id: input.clinicId,
      user_id: input.userId,
      user_email: input.userEmail,
      target_plan_id: input.targetPlanId,
      target_pricing_id: input.targetPricingId ?? null,
      trial_mode: input.trialMode ?? null,
      is_sandbox: input.isSandbox,
      checkout_url: input.checkoutUrl,
      expires_at: expiresAt,
    })
    .select('*')
    .single()

  if (error || !data) {
    logBilling('error', 'Failed to create billing checkout attempt.', {
      clinicId: input.clinicId,
      userId: input.userId,
      userEmail: input.userEmail,
      targetPlanId: input.targetPlanId,
      error: error?.message ?? 'Unknown error',
    })
    throw error ?? new Error('Failed to create billing checkout attempt.')
  }

  logBilling('info', 'Created billing checkout attempt.', {
    clinicId: input.clinicId,
    userId: input.userId,
    userEmail: input.userEmail,
    checkoutAttemptId: data.id,
    targetPlanId: input.targetPlanId,
    isSandbox: input.isSandbox,
    expiresAt,
  })

  return data as ClinicBillingCheckoutAttemptRow
}

export async function findActiveCheckoutAttemptsForUser(input: {
  userId: string
  userEmail: string
}) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_attempts')
    .select('*')
    .eq('user_id', input.userId)
    .eq('user_email', input.userEmail)
    .is('processed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    logBilling('error', 'Failed to load active billing checkout attempts for user.', {
      userId: input.userId,
      userEmail: input.userEmail,
      error: error.message,
    })
    throw error
  }

  return (data as ClinicBillingCheckoutAttemptRow[] | null) ?? []
}

export async function findActiveCheckoutAttemptByEmail(userEmail: string) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_checkout_attempts')
    .select('*')
    .eq('user_email', userEmail)
    .is('processed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(2)

  if (error) {
    logBilling('error', 'Failed to load active billing checkout attempt by email.', {
      userEmail,
      error: error.message,
    })
    throw error
  }

  const rows = (data as ClinicBillingCheckoutAttemptRow[] | null) ?? []
  if (rows.length > 1) {
    logBilling('warn', 'Multiple active billing checkout attempts matched one email.', {
      userEmail,
      checkoutAttemptIds: rows.map((row) => row.id),
    })
    return null
  }

  return rows[0] ?? null
}

export async function findClinicFreemiusBillingByLicenseId(licenseId: string) {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_freemius')
    .select('*')
    .eq('fs_license_id', licenseId)
    .maybeSingle()

  if (error) {
    logBilling('error', 'Failed to load clinic billing row by Freemius license id.', {
      licenseId,
      error: error.message,
    })
    throw error
  }

  return (data as ClinicFreemiusBillingRow | null) ?? null
}

export async function markCheckoutAttemptProcessed(input: {
  checkoutAttemptId: string
  licenseId: string
}) {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('clinic_billing_checkout_attempts')
    .update({
      fs_license_id: input.licenseId,
      processed_at: new Date().toISOString(),
    })
    .eq('id', input.checkoutAttemptId)

  if (error) {
    logBilling('error', 'Failed to mark checkout attempt as processed.', {
      checkoutAttemptId: input.checkoutAttemptId,
      licenseId: input.licenseId,
      error: error.message,
    })
    throw error
  }
}

export async function syncClinicFreemiusBillingFromLicense(
  input: SyncClinicFreemiusBillingInput
) {
  const record = await loadFreemiusSyncRecord(input.licenseId)
  const row = mapFreemiusRecordToBillingRow({
    clinicId: input.clinicId,
    ownerUserId: input.ownerUserId ?? null,
    userEmail: input.userEmail ?? null,
    record,
    lastEventType: input.lastEventType ?? null,
    lastEventId: input.lastEventId ?? null,
  })

  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from('clinic_billing_freemius')
    .upsert(row, { onConflict: 'clinic_id' })
    .select('*')
    .single()

  if (error || !data) {
    logBilling('error', 'Failed to sync clinic Freemius billing row.', {
      clinicId: input.clinicId,
      licenseId: input.licenseId,
      lastEventType: input.lastEventType ?? null,
      error: error?.message ?? 'Unknown error',
    })
    throw error ?? new Error('Failed to sync clinic Freemius billing row.')
  }

  logBilling('info', 'Synced clinic Freemius billing row.', {
    clinicId: input.clinicId,
    licenseId: input.licenseId,
    pricingId: row.fs_pricing_id,
    state: row.status,
    isCanceled: row.is_canceled,
    lastEventType: row.last_event_type,
  })

  return data as ClinicFreemiusBillingRow
}

export async function syncClinicFreemiusBillingFromRedirect(input: {
  redirectEmail: string
  licenseId: string
  lastEventType?: string | null
}) {
  const attempt = await findActiveCheckoutAttemptByEmail(input.redirectEmail)

  if (!attempt) {
    logBilling('warn', 'No pending checkout attempt matched Freemius redirect.', {
      redirectEmail: input.redirectEmail,
      licenseId: input.licenseId,
      lastEventType: input.lastEventType ?? null,
    })
    return null
  }

  const billingRow = await syncClinicFreemiusBillingFromLicense({
    clinicId: attempt.clinic_id,
    ownerUserId: attempt.user_id,
    userEmail: attempt.user_email,
    licenseId: input.licenseId,
    lastEventType: input.lastEventType ?? 'redirect.purchase',
  })

  await markCheckoutAttemptProcessed({
    checkoutAttemptId: attempt.id,
    licenseId: input.licenseId,
  })

  return billingRow
}

export async function syncClinicFreemiusBillingByReference(input: {
  licenseId: string
  userEmail?: string | null
  lastEventType?: string | null
  lastEventId?: string | null
}) {
  const existingBillingRow = await findClinicFreemiusBillingByLicenseId(input.licenseId)

  if (existingBillingRow) {
    return syncClinicFreemiusBillingFromLicense({
      clinicId: existingBillingRow.clinic_id,
      ownerUserId: existingBillingRow.owner_user_id,
      userEmail: existingBillingRow.user_email ?? input.userEmail ?? null,
      licenseId: input.licenseId,
      lastEventType: input.lastEventType ?? null,
      lastEventId: input.lastEventId ?? null,
    })
  }

  if (!input.userEmail) {
    logBilling('warn', 'Skipping Freemius billing sync because user email was missing.', {
      licenseId: input.licenseId,
      lastEventType: input.lastEventType ?? null,
      lastEventId: input.lastEventId ?? null,
    })
    return null
  }

  const attempt = await findActiveCheckoutAttemptByEmail(input.userEmail)
  if (!attempt) {
    logBilling('warn', 'No active checkout attempt matched Freemius billing sync reference.', {
      licenseId: input.licenseId,
      userEmail: input.userEmail,
      lastEventType: input.lastEventType ?? null,
      lastEventId: input.lastEventId ?? null,
    })
    return null
  }

  const billingRow = await syncClinicFreemiusBillingFromLicense({
    clinicId: attempt.clinic_id,
    ownerUserId: attempt.user_id,
    userEmail: attempt.user_email,
    licenseId: input.licenseId,
    lastEventType: input.lastEventType ?? null,
    lastEventId: input.lastEventId ?? null,
  })

  await markCheckoutAttemptProcessed({
    checkoutAttemptId: attempt.id,
    licenseId: input.licenseId,
  })

  return billingRow
}
