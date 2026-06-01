import { formatServicePriceLabel, formatServicePriceSummary } from '@/lib/clinics/service-pricing'

export const serviceSelectFields =
  'id,clinic_id,name,description,category,price_type,price_amount,price_min_amount,price_max_amount,price_currency,pricing_note,is_price_visible_to_chatbot,requires_consultation,duration_minutes,is_active,sort_order,created_at,updated_at' as const

export function mapServiceRow(
  row: Record<string, unknown>,
  defaultCurrency: string,
) {
  const priceType = String(row.price_type ?? 'fixed') as 'fixed' | 'starting_from' | 'range' | 'free' | 'quote_required'
  const priceAmount = typeof row.price_amount === 'number' ? row.price_amount : row.price_amount == null ? null : Number(row.price_amount)
  const priceMinAmount = typeof row.price_min_amount === 'number' ? row.price_min_amount : row.price_min_amount == null ? null : Number(row.price_min_amount)
  const priceMaxAmount = typeof row.price_max_amount === 'number' ? row.price_max_amount : row.price_max_amount == null ? null : Number(row.price_max_amount)
  const priceCurrency = typeof row.price_currency === 'string' ? row.price_currency : null
  const isPriceVisibleToChatbot = Boolean(row.is_price_visible_to_chatbot)

  return {
    id: row.id,
    clinicId: row.clinic_id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceType,
    priceAmount,
    priceMinAmount,
    priceMaxAmount,
    priceCurrency,
    pricingNote: row.pricing_note,
    isPriceVisibleToChatbot,
    requiresConsultation: Boolean(row.requires_consultation),
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pricingSummary: formatServicePriceSummary({
      price_type: priceType,
      price_amount: priceAmount,
      price_min_amount: priceMinAmount,
      price_max_amount: priceMaxAmount,
      price_currency: priceCurrency,
      is_price_visible_to_chatbot: isPriceVisibleToChatbot,
    }, defaultCurrency, { respectVisibility: false }),
    price: formatServicePriceLabel({
      price_type: priceType,
      price_amount: priceAmount,
      price_min_amount: priceMinAmount,
      price_max_amount: priceMaxAmount,
      price_currency: priceCurrency,
      is_price_visible_to_chatbot: isPriceVisibleToChatbot,
    }, defaultCurrency),
  }
}
