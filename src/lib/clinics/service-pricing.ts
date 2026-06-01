import type { ServicePriceType } from '@/lib/clinics/validation'

type PricingShape = {
  price_type: ServicePriceType
  price_amount: number | null
  price_min_amount: number | null
  price_max_amount: number | null
  price_currency: string | null
  is_price_visible_to_chatbot: boolean
}

type PromptPricingShape = PricingShape & {
  name: string
  pricing_note: string | null
  requires_consultation: boolean
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Number.isInteger(value) ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function resolveCurrency(priceCurrency: string | null, clinicDefaultCurrency: string | null | undefined) {
  return priceCurrency ?? clinicDefaultCurrency ?? 'USD'
}

export function formatServicePriceLabel(service: PricingShape, clinicDefaultCurrency?: string | null) {
  return formatServicePriceSummary(service, clinicDefaultCurrency, { respectVisibility: true })
}

export function formatServicePriceSummary(
  service: PricingShape,
  clinicDefaultCurrency?: string | null,
  options?: { respectVisibility?: boolean },
) {
  if (options?.respectVisibility !== false && !service.is_price_visible_to_chatbot) return null

  const currency = resolveCurrency(service.price_currency, clinicDefaultCurrency)

  switch (service.price_type) {
    case 'fixed':
      return service.price_amount === null ? null : formatMoney(service.price_amount, currency)
    case 'starting_from':
      return service.price_amount === null ? null : `Starts from ${formatMoney(service.price_amount, currency)}`
    case 'range':
      if (service.price_min_amount === null || service.price_max_amount === null) return null
      return `${formatMoney(service.price_min_amount, currency)} - ${formatMoney(service.price_max_amount, currency)}`
    case 'free':
      return 'Free'
    case 'quote_required':
      return 'Quote after consultation'
  }
}

export function formatServicePricingPrompt(service: PromptPricingShape, clinicDefaultCurrency?: string | null) {
  const currency = resolveCurrency(service.price_currency, clinicDefaultCurrency)

  if (!service.is_price_visible_to_chatbot) {
    return `Pricing for ${service.name}: Do not share the price. Ask the patient to request a quote or book a consultation instead.`
  }

  const priceText = (() => {
    switch (service.price_type) {
      case 'fixed':
        return service.price_amount === null ? 'Price is not available.' : `Price: ${formatMoney(service.price_amount, currency)}.`
      case 'starting_from':
        return service.price_amount === null ? 'Starting price is not available.' : `Starts from ${formatMoney(service.price_amount, currency)}.`
      case 'range':
        if (service.price_min_amount === null || service.price_max_amount === null) return 'Price range is not available.'
        return `Price range: ${formatMoney(service.price_min_amount, currency)} - ${formatMoney(service.price_max_amount, currency)}.`
      case 'free':
        return 'Price: Free.'
      case 'quote_required':
        return 'Price: Quote required after consultation. Do not invent a number.'
    }
  })()

  const consultationText = service.requires_consultation
    ? ' Consultation is required before final confirmation.'
    : ''
  const noteText = service.pricing_note ? ` Note: ${service.pricing_note}` : ''

  return `Pricing for ${service.name}: ${priceText}${consultationText}${noteText}`.trim()
}
