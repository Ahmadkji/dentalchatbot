import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { setPrivateNoStore } from '@/lib/auth/response'
import { requireCurrentClinicAccess } from '@/lib/clinic-access'
import {
  getClinicFreemiusBillingStatus,
  getFreemiusDefaultPlanId,
  getFreemiusReturnUrl,
  getFreemiusWebhookUrl,
  getFreemiusWidgetBillingUrl,
} from '@/lib/billing/freemius-server'
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
    const billing = await getClinicFreemiusBillingStatus(clinicAccess.current.clinic.id)

    return buildResponse({
      clinicId: clinicAccess.current.clinic.id,
      membershipRole: clinicAccess.current.membership?.role ?? null,
      billing,
      defaultPlanId: getFreemiusDefaultPlanId(),
      returnUrl: getFreemiusReturnUrl(),
      webhookUrl: getFreemiusWebhookUrl(),
      dashboardUrl: getFreemiusWidgetBillingUrl(),
    })
  } catch (error) {
    safeErrorLog('billing:freemius:status', error)
    return buildResponse({ error: 'Failed to load billing status.' }, 500)
  }
}
