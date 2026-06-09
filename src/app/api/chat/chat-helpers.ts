import { type CurrentClinicAiProfile, getCurrentClinicAiProfile } from '@/lib/clinics/current'
import { formatServicePricingPrompt } from '@/lib/clinics/service-pricing'
import { formatClinicHoursSummary, isClinicOpenNow } from '@/lib/clinics/hours'
import { searchKnowledgeChunks } from '@/lib/knowledge/sources'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'

// ─── Types ─────────────────────────────────────────────────────

export type CitationRow = {
  chunkId: string
  sourceType: string
  sourceTitle: string
  retrievalScore: number
  scoreType: 'lexical' | 'vector' | 'hybrid'
}

// ─── Prompt helpers ─────────────────────────────────────────────

export function formatPromptService(service: {
  name: string
  category: string | null
  description: string | null
  duration_minutes: number
  price_type: 'fixed' | 'starting_from' | 'range' | 'free' | 'quote_required'
  price_amount: number | null
  price_min_amount: number | null
  price_max_amount: number | null
  price_currency: string | null
  pricing_note: string | null
  is_price_visible_to_chatbot: boolean
  requires_consultation: boolean
}, clinicDefaultCurrency: string | null | undefined) {
  const category = service.category ? ` (${service.category})` : ''
  const description = service.description ? ` ${service.description}` : ''
  const pricing = formatServicePricingPrompt({
    name: service.name,
    price_type: service.price_type,
    price_amount: service.price_amount,
    price_min_amount: service.price_min_amount,
    price_max_amount: service.price_max_amount,
    price_currency: service.price_currency,
    pricing_note: service.pricing_note,
    is_price_visible_to_chatbot: service.is_price_visible_to_chatbot,
    requires_consultation: service.requires_consultation,
  }, clinicDefaultCurrency)

  return `- ${service.name}${category}:${description} Duration: ${service.duration_minutes} minutes. ${pricing}`
}

export function formatDateTimeForClinic(timezone: string | null | undefined) {
  const now = new Date()
  if (!timezone) {
    return {
      iso: now.toISOString(),
      dayName: now.toLocaleDateString('en-US', { weekday: 'long' }),
    }
  }

  return {
    iso: new Intl.DateTimeFormat('en-CA', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: timezone,
    }).format(now),
    dayName: new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    }).format(now),
  }
}

export function formatKnowledgeChunks(
  chunks: Awaited<ReturnType<typeof searchKnowledgeChunks>>,
) {
  if (!chunks.length) {
    return '- No additional trained knowledge matched this question.'
  }

  return chunks
    .map((chunk, index) => {
      const sourceLabel =
        chunk.source_type === 'faq'
          ? `FAQ: ${chunk.knowledge_sources.title}`
          : chunk.source_type === 'manual_text'
            ? `Manual note: ${chunk.knowledge_sources.title}`
            : chunk.source_type === 'file_upload'
              ? `Document: ${chunk.file_name || chunk.knowledge_sources.title}`
              : `Website: ${chunk.page_title || chunk.knowledge_sources.title}`

      return [
        `Source ${index + 1} - ${sourceLabel}`,
        chunk.section_heading ? `Section: ${chunk.section_heading}` : null,
        chunk.source_url ? `URL: ${chunk.source_url}` : null,
        chunk.chunk_text,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

// ─── Clinic resolution ─────────────────────────────────────────

async function getPreviewClinicAiProfile(
  clinicId: string,
  userId: string,
) {
  const supabase = await createSupabaseRouteClient()
  if (!supabase) return null

  const { data: membership, error: membershipError } = await supabase
    .from('clinic_members')
    .select('clinic_id')
    .eq('clinic_id', clinicId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership) return null

  const { data, error } = await supabase
    .from('clinic_ai_profile_view')
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (error) throw error
  return (data as CurrentClinicAiProfile | null) ?? null
}

async function getPublicClinicAiProfile(clinicId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('clinic_ai_profile_view')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('status', 'active')
    .eq('is_live', true)
    .eq('widget_enabled', true)
    .maybeSingle()

  if (error) throw error
  return (data as CurrentClinicAiProfile | null) ?? null
}

async function getPublicClinicAiProfileBySlug(slug: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('clinic_ai_profile_view')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .eq('is_live', true)
    .eq('widget_enabled', true)
    .maybeSingle()

  if (error) throw error
  return (data as CurrentClinicAiProfile | null) ?? null
}

// ─── Support level classification ──────────────────────────────

export type SupportLevel = 'strong' | 'medium' | 'weak'

export function classifySupport(knowledgeChunks: Awaited<ReturnType<typeof searchKnowledgeChunks>>): SupportLevel {
  if (knowledgeChunks.length === 0) return 'weak'

  const hasHighPriority = knowledgeChunks.some(
    (c) => c.source_type === 'faq' || c.source_type === 'manual_text'
  )
  const hitCount = knowledgeChunks.length

  if (hitCount >= 3 && hasHighPriority) return 'strong'
  if (hitCount >= 1) return 'medium'
  return 'weak'
}

// ─── System prompt builder ─────────────────────────────────────

export async function buildSystemPrompt(input: {
  clinicId?: string | null
  clinicSlug?: string | null
  preview?: boolean
  message: string
}) {
  let aiProfile: CurrentClinicAiProfile | null = null
  let clinicId: string | null = input.clinicId ?? null
  let userId: string | null = null

  // Resolve clinic context
  if (input.clinicSlug && !input.clinicId) {
    // Slug-only resolution (public path)
    aiProfile = await getPublicClinicAiProfileBySlug(input.clinicSlug)
    clinicId = aiProfile?.clinic_id ?? null
  } else if (input.clinicId && input.preview) {
    // Preview path - needs auth
    const supabase = await createSupabaseRouteClient()
    const { data: { user } } = supabase
      ? await supabase.auth.getUser()
      : { data: { user: null } }

    if (user) {
      aiProfile = await getPreviewClinicAiProfile(input.clinicId, user.id)
      userId = user.id
    }
  } else if (input.clinicId) {
    // Public path with clinicId
    aiProfile = await getPublicClinicAiProfile(input.clinicId)
  } else {
    // Dashboard path - authenticated, resolve current clinic
    const supabase = await createSupabaseRouteClient()
    const { data: { user } } = supabase
      ? await supabase.auth.getUser()
      : { data: { user: null } }

    if (user && supabase) {
      const current = await getCurrentClinicAiProfile(supabase, user)
      aiProfile = current?.aiProfile ?? null
      clinicId = current?.aiProfile?.clinic_id ?? null
      userId = user.id
    }
  }

  const clinicHours = aiProfile
    ? formatClinicHoursSummary(aiProfile.clinic_hours)
    : 'The clinic has not added confirmed opening hours yet.'
  const clinicName = aiProfile?.name || 'the dental clinic'
  const clinicAddress = aiProfile?.address || 'The clinic has not added its address yet.'
  const clinicPhone = aiProfile?.phone || 'The clinic has not added its phone number yet.'
  const whatsappNumber = aiProfile?.whatsapp || ''
  const appointmentRules = aiProfile?.appointment_rules || 'The clinic has not provided appointment rules yet. Ask the clinic directly.'
  const pricingNotes = aiProfile?.pricing_notes || 'The clinic has not published pricing notes yet. Do not invent prices.'
  const emergencyInstructions = aiProfile?.emergency_instructions || aiProfile?.emergency_message || 'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, contact the clinic or emergency services immediately.'
  const fallbackMessage = aiProfile?.fallback_message || "I'm not fully sure about that. Please contact the clinic directly so staff can help you correctly."
  const medicalDisclaimer = aiProfile?.medical_disclaimer || "I can't diagnose dental or medical conditions."
  const servicesBlock = aiProfile?.active_services.length
    ? aiProfile.active_services.map((service) => formatPromptService(service, aiProfile?.default_currency)).join('\n')
    : '- The clinic has not published approved services yet.'
  const afterHours = aiProfile
    ? !isClinicOpenNow(aiProfile.clinic_hours, aiProfile.timezone)
    : false
  const timeContext = formatDateTimeForClinic(aiProfile?.timezone)

  // Knowledge retrieval (lexical FTS)
  const adminClient = createSupabaseAdminClient()
  const knowledgeChunks =
    clinicId && aiProfile
      ? await searchKnowledgeChunks(adminClient, clinicId, input.message, { limit: 5 })
      : []
  const approvedKnowledgeBlock = formatKnowledgeChunks(knowledgeChunks)

  const systemPrompt = `You are the AI assistant for ${clinicName}.

CLINIC INFORMATION:
- Name: ${clinicName}
- Address: ${clinicAddress}
- Phone: ${clinicPhone}
- WhatsApp: ${whatsappNumber || 'The clinic has not added WhatsApp yet.'}
- Working Hours: ${clinicHours}
- Appointment Rules: ${appointmentRules}
- Pricing Notes: ${pricingNotes}
- Emergency Instructions: ${emergencyInstructions}
- Website: ${aiProfile?.website_url || 'The clinic has not added a website yet.'}
- Map Link: ${aiProfile?.map_link || 'The clinic has not added a map link yet.'}

CURRENT TIME: ${timeContext.iso}
CURRENT DAY: ${timeContext.dayName}

AFTER-HOURS DETECTION:
${afterHours ? `The clinic appears to be closed right now. Begin your first response with: "We're currently closed, but I can still help. Our hours are ${clinicHours}. You can leave your details and our staff will contact you when we open."` : 'The clinic appears open right now based on the saved schedule.'}

SERVICES OFFERED:
${servicesBlock}

APPROVED KNOWLEDGE SOURCES:
${approvedKnowledgeBlock}

IMPORTANT RULES:
1. NEVER diagnose medical conditions. If a patient describes symptoms, use wording like: "${medicalDisclaimer} I can help you contact the clinic or choose the right service."
2. For appointment requests, collect: name, phone number, preferred date, preferred time, and reason for visit. You can also ask if they have a preferred doctor.
3. Answer only from the approved clinic information, active services, and approved knowledge sources above. Do not answer from imported website drafts, frontend state, hidden settings, or assumed facts. When information is missing or uncertain, say exactly: "${fallbackMessage}"
4. If someone asks about location, provide the saved address or map link only. If missing, say the clinic has not added confirmed location details yet.
5. If someone asks about WhatsApp, say they can continue the conversation on WhatsApp.
6. For emergency questions, first use the saved emergency instructions. If there is severe pain, swelling, bleeding, trauma, or breathing difficulty, tell them to contact the clinic or emergency services immediately.
7. Be warm, professional, and empathetic. Match the tone: ${aiProfile?.tone || 'friendly'}.
8. When collecting information (appointments, leads), ask one piece of info at a time naturally in conversation.
9. If the patient seems to want human help, encourage them to call or use WhatsApp.
10. Inactive services, unapproved website imports, private staff data, and draft knowledge must never appear in your answer.`

  return {
    systemPrompt,
    userId,
    afterHours,
    clinicId,
    knowledgeChunks,
    supportLevel: classifySupport(knowledgeChunks),
    aiProfile,
    clinicSettings: {
      clinic_name: clinicName,
      clinic_address: aiProfile?.address || '',
      clinic_phone: aiProfile?.phone || '',
      whatsapp_number: whatsappNumber,
      clinic_hours: clinicHours,
      emergency_phone: aiProfile?.phone || '',
      bot_primary_color: aiProfile?.primary_color || '#059669',
      welcome_message: aiProfile?.welcome_message || 'Hi! How can I help you today?',
    },
  }
}

// ─── Runtime customization settings ─────────────────────────

export type RuntimeCustomizationSettings = {
  chatMode: 'human' | 'ai'
}

export async function loadRuntimeCustomizationSettings(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
): Promise<RuntimeCustomizationSettings> {
  const { data, error } = await adminClient
    .from('clinic_settings')
    .select('key,value')
    .eq('clinic_id', clinicId)
    .eq('key', 'chat_mode')

  if (error) throw error

  const kv = new Map<string, string>((data ?? []).map((row) => [row.key as string, row.value as string]))

  return {
    chatMode: kv.get('chat_mode') === 'human' ? 'human' : 'ai',
  }
}
