import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { setPrivateNoStore } from '@/lib/auth/response'
import { requireCurrentClinicAccess } from '@/lib/clinic-access'
import {
  CheckoutSessionAlreadyExistsError,
  createLemonSqueezyCheckout,
  createPendingCheckoutSession,
  expireStaleCheckoutSessions,
  findPendingCheckoutSession,
  findReusableCheckoutSession,
  getLemonSqueezyDefaultVariantId,
  isLemonSqueezyTestModeEnabled,
  markCheckoutSessionCreated,
  markCheckoutSessionFailed,
} from '@/lib/billing/lemonsqueezy-server'
import { consumeDistributedRateLimit } from '@/lib/rate-limit'
import { assertSameOrigin, safeErrorLog } from '@/lib/security'

const requestSchema = z.object({
  variantId: z.string().trim().min(1).optional(),
})

function buildResponse(body: unknown, status = 200) {
  return setPrivateNoStore(NextResponse.json(body, { status }))
}

async function enforceCheckoutRateLimit(userId: string) {
  const result = await consumeDistributedRateLimit(
    `billing-checkout:${userId}`,
    5,
    10 * 60 * 1000,
    1,
    false,
  )

  if (result.allowed) return null

  const response = buildResponse(
    { error: 'Too many checkout attempts. Please try again later.', resetAt: result.resetAt },
    429,
  )
  response.headers.set('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))))
  return response
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)

  try {
    assertSameOrigin(request.headers.get('origin'), url)
  } catch (originError) {
    console.error('[billing:lemonsqueezy:checkout] CSRF origin check failed', {
      origin: request.headers.get('origin'),
      host: url.host,
      error: originError instanceof Error ? originError.message : String(originError),
    })
    return buildResponse({ error: 'Forbidden' }, 403)
  }

  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return setPrivateNoStore(authError)
  if (!user || !supabase) return buildResponse({ error: 'Unauthorized' }, 401)

  const rateLimitResponse = await enforceCheckoutRateLimit(user.id)
  if (rateLimitResponse) return rateLimitResponse

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

  const variantId = parsed.data.variantId ?? getLemonSqueezyDefaultVariantId()
  if (!variantId) {
    console.error('[billing:lemonsqueezy:checkout] Missing default Lemon Squeezy variant id', {
      clinicId: clinicAccess.current.clinic.id,
      userId: user.id,
    })
    return buildResponse({ error: 'Lemon Squeezy variant configuration is missing.' }, 500)
  }

  const testMode = isLemonSqueezyTestModeEnabled()

  try {
    await expireStaleCheckoutSessions({
      clinicId: clinicAccess.current.clinic.id,
      userId: user.id,
      variantId,
      testMode,
    })

    const reusableSession = await findReusableCheckoutSession({
      clinicId: clinicAccess.current.clinic.id,
      userId: user.id,
      variantId,
      testMode,
    })

    if (reusableSession?.checkout_url) {
      return buildResponse({
        url: reusableSession.checkout_url,
        sessionId: reusableSession.id,
        expiresAt: reusableSession.expires_at,
        reused: true,
      })
    }

    let checkoutSession
    try {
      checkoutSession = await createPendingCheckoutSession({
        clinicId: clinicAccess.current.clinic.id,
        userId: user.id,
        userEmail,
        variantId,
        testMode,
      })
    } catch (sessionError) {
      if (sessionError instanceof CheckoutSessionAlreadyExistsError) {
        const pendingSession = await findPendingCheckoutSession({
          clinicId: clinicAccess.current.clinic.id,
          userId: user.id,
          variantId,
          testMode,
        })

        if (pendingSession?.checkout_url) {
          return buildResponse({
            url: pendingSession.checkout_url,
            sessionId: pendingSession.id,
            expiresAt: pendingSession.expires_at,
            reused: true,
          })
        }

        return buildResponse(
          { error: 'A checkout link is already being created. Please try again in a few seconds.' },
          409,
        )
      }

      throw sessionError
    }

    try {
      const checkout = await createLemonSqueezyCheckout({
        checkoutSessionId: checkoutSession.id,
        clinicId: clinicAccess.current.clinic.id,
        userId: user.id,
        userEmail,
        userName: clinicAccess.current.profile.full_name,
        variantId,
        testMode,
        expiresAt: checkoutSession.expires_at,
      })

      const createdSession = await markCheckoutSessionCreated({
        checkoutSessionId: checkoutSession.id,
        lemonCheckoutId: checkout.checkoutId,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: checkout.expiresAt,
      })

      return buildResponse({
        url: checkout.checkoutUrl,
        sessionId: createdSession.id,
        expiresAt: createdSession.expires_at,
        reused: false,
      })
    } catch (checkoutError) {
      await markCheckoutSessionFailed({
        checkoutSessionId: checkoutSession.id,
        reason: checkoutError instanceof Error ? checkoutError.message : String(checkoutError),
      })
      throw checkoutError
    }
  } catch (error) {
    safeErrorLog('billing:lemonsqueezy:checkout', error)
    return buildResponse({ error: 'Failed to create Lemon Squeezy checkout.' }, 500)
  }
}
