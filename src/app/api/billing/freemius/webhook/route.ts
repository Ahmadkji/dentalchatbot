import {
  getFreemiusServerClient,
  syncClinicFreemiusBillingByReference,
} from '@/lib/billing/freemius-server'

const LICENSE_EVENT_TYPES = [
  'license.created',
  'license.updated',
  'license.extended',
  'license.shortened',
  'license.plan.changed',
  'license.expired',
  'license.cancelled',
] as const

export async function POST(request: Request) {
  const freemius = getFreemiusServerClient()
  const listener = freemius.webhook.createListener({
    onError: async (error) => {
      console.error('[billing:freemius:webhook] Listener processing failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    },
  })

  listener.on([...LICENSE_EVENT_TYPES], async (event) => {
    await syncClinicFreemiusBillingByReference({
      licenseId: String(event.objects.license.id),
      userEmail: event.objects.user?.email ?? null,
      lastEventType: event.type,
      lastEventId: event.id,
    })
  })

  return freemius.webhook.processFetch(listener, request)
}
