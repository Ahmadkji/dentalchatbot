const FREEMIUS_BASE_CHECKOUT_URL = 'https://checkout.freemius.com'

function getPublicEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function getFreemiusProductId() {
  return getPublicEnvValue(process.env.NEXT_PUBLIC_FREEMIUS_PRODUCT_ID)
}

export function getFreemiusPlanId() {
  return getPublicEnvValue(process.env.NEXT_PUBLIC_FREEMIUS_PLAN_ID)
}

export function hasFreemiusCheckoutConfig() {
  return Boolean(getFreemiusProductId() && getFreemiusPlanId())
}

export function buildFreemiusCheckoutUrl(options: {
  userEmail?: string
  readonlyUser?: boolean
  extraParams?: Record<string, string | number | boolean | null | undefined>
} = {}) {
  const productId = getFreemiusProductId()
  const planId = getFreemiusPlanId()

  if (!productId || !planId) {
    return null
  }

  const url = new URL(`${FREEMIUS_BASE_CHECKOUT_URL}/product/${productId}/plan/${planId}/`)

  if (options.userEmail) {
    url.searchParams.set('user_email', options.userEmail)
    url.searchParams.set('readonly_user', options.readonlyUser === false ? 'false' : 'true')
  }

  Object.entries(options.extraParams ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}
