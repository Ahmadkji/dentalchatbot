import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { setPrivateNoStore } from '@/lib/auth/response'
import { requireCurrentClinicAccess } from '@/lib/clinic-access'
import {
  getBillingDashboardUrl,
  getClinicBillingStatus,
  getLemonSqueezyDefaultVariantId,
  getLemonSqueezyWebhookUrl,
  isLemonSqueezyCheckoutConfigured,
  isLemonSqueezyTestModeEnabled,
} from '@/lib/billing/lemonsqueezy-server'
import { safeErrorLog } from '@/lib/security'

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return setPrivateNoStore(authError)
  if (!user || !supabase) return buildResponse({ error: 'Unauthorized' }, 401)

  const clinicAccess = await requireCurrentClinicAccess(supabase, user)
  if (clinicAccess.error) return setPrivateNoStore(clinicAccess.error)

  try {
    const billing = await getClinicBillingStatus(clinicAccess.current.clinic.id)

    return buildResponse({
      provider: 'lemonsqueezy',
      clinicId: clinicAccess.current.clinic.id,
      membershipRole: clinicAccess.current.membership?.role ?? null,
      billing,
      defaultVariantId: getLemonSqueezyDefaultVariantId(),
      checkoutConfigured: isLemonSqueezyCheckoutConfigured(),
      testMode: isLemonSqueezyTestModeEnabled(),
      webhookUrl: getLemonSqueezyWebhookUrl(),
      dashboardUrl: getBillingDashboardUrl(),
    })
  } catch (error) {
    safeErrorLog('billing:lemonsqueezy:status', error)
    return buildResponse({ error: 'Failed to load billing status.' }, 500)
  }
}
