import { NextRequest, NextResponse } from 'next/server'
import {
  getFreemiusServerClient,
  getFreemiusWidgetBillingUrl,
  syncClinicFreemiusBillingFromRedirect,
} from '@/lib/billing/freemius-server'
import { getSiteUrl } from '@/lib/site-url'
import { safeErrorLog } from '@/lib/security'

function buildRedirectUrl(status: 'invalid' | 'received' | 'success' | 'error') {
  const redirectUrl = new URL(getFreemiusWidgetBillingUrl())
  redirectUrl.searchParams.set('billing', status)
  return redirectUrl
}

export async function GET(request: NextRequest) {
  try {
    const freemius = getFreemiusServerClient()
    const redirectInfo = await freemius.checkout.processRedirect(request.url, getSiteUrl())

    if (!redirectInfo?.license_id || !redirectInfo.email) {
      return NextResponse.redirect(buildRedirectUrl('invalid'))
    }

    const synced = await syncClinicFreemiusBillingFromRedirect({
      redirectEmail: redirectInfo.email,
      licenseId: redirectInfo.license_id,
      lastEventType: `redirect.${redirectInfo.action}`,
    })

    return NextResponse.redirect(buildRedirectUrl(synced ? 'success' : 'received'))
  } catch (error) {
    safeErrorLog('billing:freemius:return', error)
    return NextResponse.redirect(buildRedirectUrl('error'))
  }
}
