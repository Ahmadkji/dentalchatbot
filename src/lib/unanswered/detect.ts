export type UnansweredSupportLevel = 'strong' | 'medium' | 'weak'

export type UnansweredReason =
  | 'no_relevant_chunks'
  | 'unsupported_topic'
  | 'medical_diagnosis'
  | 'service_not_found'
  | 'price_not_found'

const DEFAULT_FALLBACK_PHRASES = [
  "i'm not fully sure",
  'please contact the clinic directly',
  "i can't diagnose",
]

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function detectUnansweredReason(input: {
  supportLevel: UnansweredSupportLevel
  userMessage: string
  aiResponse: string
  hasRelevantChunks: boolean
  fallbackMessage?: string | null
}): UnansweredReason | null {
  const lowerMsg = normalizeText(input.userMessage)
  const lowerResp = normalizeText(input.aiResponse)

  if (!input.hasRelevantChunks) return 'no_relevant_chunks'

  const fallbackCandidates = [
    ...DEFAULT_FALLBACK_PHRASES,
    input.fallbackMessage ? normalizeText(input.fallbackMessage) : '',
  ].filter(Boolean)

  const isFallback = fallbackCandidates.some((phrase) => lowerResp.includes(phrase))
  if (!isFallback) return null

  if (lowerResp.includes("i can't diagnose") || lowerResp.includes('medical conditions')) {
    return 'medical_diagnosis'
  }
  if (/price|cost|fee|how much/.test(lowerMsg)) {
    return 'price_not_found'
  }
  if (/service|treatment|do you (offer|do|provide)|whitelist/.test(lowerMsg)) {
    return 'service_not_found'
  }

  return 'unsupported_topic'
}
