import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { setPrivateNoStore } from '@/lib/auth/response'
import { requireCurrentClinicAccess } from '@/lib/clinic-access'
import {
  createClinicBillingCheckoutAttempt,
  findActiveCheckoutAttemptsForUser,
  getFreemiusDefaultPlanId,
  getFreemiusServerClient,
  getFreemiusWidgetBillingUrl,
} from '@/lib/billing/freemius-server'
import { assertSameOrigin, safeErrorLog } from '@/lib/security'

const requestSchema = z.object({
  planId: z.string().trim().min(1).optional(),
  pricingId: z.string().trim().min(1).optional(),
  trialMode: z.enum(['free', 'paid']).nullable().optional(),
  isSandbox: z.boolean().optional(),
})

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch (originError) {
    console.error('[billing:freemius:checkout] CSRF origin check failed', {
      origin: request.headers.get('origin'),
      host: url.host,
      error: originError instanceof Error ? originError.message : String(originError),
    })
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return setPrivateNoStore(authError)
  if (!user || !supabase) return buildResponse({ error: 'Unauthorized' }, 401)

  const clinicAccess = await requireCurrentClinicAccess(supabase, user, ['owner', 'admin'])
  if (clinicAccess.error) return setPrivateNoStore(clinicAccess.error)

  const userEmail = user.email?.trim()
  if (!userEmail) {
    return buildResponse({ error: 'Authenticated email is missing.' }, 400)
  }

  const payload = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) {
    return buildResponse(
      { error: parsed.error.issues[0]?.message ?? 'Invalid billing checkout request.' },
      400,
    )
  }

  const planId = parsed.data.planId ?? getFreemiusDefaultPlanId()
  if (!planId) {
    console.error('[billing:freemius:checkout] Missing default Freemius plan id', {
      clinicId: clinicAccess.current.clinic.id,
      userId: user.id,
    })
    return buildResponse({ error: 'Freemius plan configuration is missing.' }, 500)
  }

  try {
    const activeAttempts = await findActiveCheckoutAttemptsForUser({
      userId: user.id,
      userEmail,
    })

    const activeAttemptForOtherClinic = activeAttempts.find(
      (attempt) => attempt.clinic_id !== clinicAccess.current.clinic.id,
    )

    if (activeAttemptForOtherClinic) {
      return buildResponse(
        {
          error:
            'You already have another billing checkout open for a different clinic. Please finish or wait for that link to expire before starting a new one.',
        },
        409,
      )
    }

    const reusableAttempt = activeAttempts.find(
      (attempt) =>
        attempt.clinic_id === clinicAccess.current.clinic.id &&
        attempt.target_plan_id === planId &&
        (attempt.target_pricing_id ?? null) === (parsed.data.pricingId ?? null) &&
        (attempt.trial_mode ?? null) === (parsed.data.trialMode ?? null) &&
        attempt.is_sandbox === Boolean(parsed.data.isSandbox),
    )

    if (reusableAttempt) {
      return buildResponse({
        url: reusableAttempt.checkout_url,
        attemptId: reusableAttempt.id,
        expiresAt: reusableAttempt.expires_at,
        reused: true,
      })
    }

    const freemius = getFreemiusServerClient()
    const checkout = await freemius.checkout.create({
      user: {
        email: userEmail,
        name: clinicAccess.current.profile.full_name ?? undefined,
      },
      isSandbox: Boolean(parsed.data.isSandbox),
      planId,
      trial: parsed.data.trialMode ?? undefined,
    })

    if (parsed.data.pricingId) {
      checkout.setPricing(parsed.data.pricingId)
    }

    checkout.setCancelButton(getFreemiusWidgetBillingUrl())

    const checkoutUrl = checkout.getLink()
    const attempt = await createClinicBillingCheckoutAttempt({
      clinicId: clinicAccess.current.clinic.id,
      userId: user.id,
      userEmail,
      targetPlanId: planId,
      targetPricingId: parsed.data.pricingId ?? null,
      trialMode: parsed.data.trialMode ?? null,
      isSandbox: Boolean(parsed.data.isSandbox),
      checkoutUrl,
    })

    return buildResponse({
      url: checkoutUrl,
      attemptId: attempt.id,
      expiresAt: attempt.expires_at,
      reused: false,
    })
  } catch (error) {
    safeErrorLog('billing:freemius:checkout', error)
    return buildResponse({ error: 'Failed to create Freemius checkout.' }, 500)
  }
}
