import { type CurrentClinicAiProfile, getCurrentClinicAiProfile } from '@/lib/clinics/current'
import { formatClinicHoursSummary, isClinicOpenNow } from '@/lib/clinics/hours'
import { searchKnowledgeChunks } from '@/lib/knowledge/sources'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import {
  mintSessionToken,
  hashSessionToken,
  CHAT_SESSION_COOKIE,
  getChatSessionCookieOptions,
  resolveChatPathType,
} from '@/lib/chat/session'
import { validatePublicSessionToken, validateCookieTokenFallback, extendTokenExpiry } from '@/lib/chat/public-widget-session'
import { publicSessionTokenSchema, uuidSchema, clinicSlugSchema, widgetAccessTokenSchema } from '@/lib/chat/widget-api-schemas'
import { verifyWidgetAccessToken } from '@/lib/widget/widget-access-token'
import { consumeDistributedRateLimit, widgetChatKey } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import {
  buildSafeAssistantReply,
  extractAutomationFields,
  mapLeadAutomationSettings,
  mergeAutomationState,
  shouldCreateAppointmentRequest,
  shouldCreateLead,
} from '@/lib/chat/automation'
import ZAI from 'z-ai-web-dev-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// ─── Types ─────────────────────────────────────────────────────

type CitationRow = {
  chunkId: string
  sourceType: string
  sourceTitle: string
  retrievalScore: number
  scoreType: 'lexical' | 'vector' | 'hybrid'
}

type UnansweredReason =
  | 'no_relevant_chunks'
  | 'unsupported_topic'
  | 'medical_diagnosis'
  | 'service_not_found'
  | 'price_not_found'

// ─── Prompt helpers (unchanged from original) ──────────────────

function formatPromptService(service: {
  name: string
  category: string | null
  description: string | null
  duration_minutes: number
  price_amount: number | null
  price_currency: string | null
  pricing_note: string | null
}) {
  const category = service.category ? ` (${service.category})` : ''
  const description = service.description ? ` ${service.description}` : ''
  const price = service.price_amount !== null && service.price_currency
    ? ` Price: ${service.price_currency} ${service.price_amount}.`
    : service.pricing_note
      ? ` Pricing: ${service.pricing_note}.`
      : ' Pricing is not published yet.'

  return `- ${service.name}${category}:${description} Duration: ${service.duration_minutes} minutes.${price}`
}

function formatDateTimeForClinic(timezone: string | null | undefined) {
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

function formatKnowledgeChunks(
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

type SupportLevel = 'strong' | 'medium' | 'weak'

function classifySupport(knowledgeChunks: Awaited<ReturnType<typeof searchKnowledgeChunks>>): SupportLevel {
  if (knowledgeChunks.length === 0) return 'weak'

  const hasHighPriority = knowledgeChunks.some(
    (c) => c.source_type === 'faq' || c.source_type === 'manual_text'
  )
  const hitCount = knowledgeChunks.length

  if (hitCount >= 3 && hasHighPriority) return 'strong'
  if (hitCount >= 1) return 'medium'
  return 'weak'
}

function detectUnansweredReason(
  supportLevel: SupportLevel,
  userMessage: string,
  aiResponse: string,
  hasRelevantChunks: boolean,
): UnansweredReason | null {
  const lowerMsg = userMessage.toLowerCase()
  const lowerResp = aiResponse.toLowerCase()

  if (!hasRelevantChunks) return 'no_relevant_chunks'

  const isFallback =
    lowerResp.includes("i'm not fully sure") ||
    lowerResp.includes("please contact the clinic directly") ||
    lowerResp.includes("i can't diagnose")

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

// ─── System prompt builder ─────────────────────────────────────

async function buildSystemPrompt(input: {
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
    ? aiProfile.active_services.map(formatPromptService).join('\n')
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

// ─── Lead automation settings loader ──────────────────────────

async function loadLeadSettings(adminClient: ReturnType<typeof createSupabaseAdminClient>, clinicId: string) {
  const { data, error } = await adminClient
    .from('clinic_settings')
    .select('key,value')
    .eq('clinic_id', clinicId)
    .like('key', 'lead_%')

  if (error) {
    throw error
  }

  return mapLeadAutomationSettings((data ?? []) as Array<{ key: string; value: string }>)
}

// ─── POST handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationId, clinicId, clinicSlug, preview, visitorId, publicSessionToken, widgetAccessToken } = body

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // Widget-specific tighter message limit (1000 chars)
    const isWidgetPublicPath = (clinicId || clinicSlug) && !preview
    if (isWidgetPublicPath && String(message).trim().length > 1000) {
      return NextResponse.json({ error: 'message is too long (max 1000 characters for widget)' }, { status: 400 })
    }

    if (String(message).trim().length > 4000) {
      return NextResponse.json({ error: 'message is too long' }, { status: 400 })
    }

    // Validate public-session-related fields format before any DB interaction
    if (conversationId && !uuidSchema.safeParse(conversationId).success) {
      return NextResponse.json({ error: 'Invalid conversationId format' }, { status: 400 })
    }
    if (clinicId && !uuidSchema.safeParse(clinicId).success) {
      return NextResponse.json({ error: 'Invalid clinicId format' }, { status: 400 })
    }
    if (publicSessionToken && !publicSessionTokenSchema.safeParse(publicSessionToken).success) {
      return NextResponse.json({ error: 'Invalid session token format' }, { status: 400 })
    }
    if (clinicSlug && !clinicSlugSchema.safeParse(clinicSlug).success) {
      return NextResponse.json({ error: 'Invalid clinicSlug format' }, { status: 400 })
    }
    if (widgetAccessToken && !widgetAccessTokenSchema.safeParse(widgetAccessToken).success) {
      return NextResponse.json({ error: 'Invalid widget access token format' }, { status: 400 })
    }

    // ── Block legacy clinicId-only public path (Finding 1) ────────
    // Public widget access now requires clinicSlug + widgetAccessToken.
    if (clinicId && !clinicSlug && !preview) {
      return NextResponse.json(
        { error: 'Public widget access requires clinicSlug. Please regenerate your embed code.' },
        { status: 400 },
      )
    }

    // ── Validate widget access token BEFORE heavy work (Finding 2) ─
    if (clinicSlug && !preview) {
      if (!widgetAccessToken) {
        return NextResponse.json({ error: 'Widget access token is required.' }, { status: 401 })
      }
      const verifiedToken = verifyWidgetAccessToken(widgetAccessToken)
      if (!verifiedToken) {
        return NextResponse.json({ error: 'Widget access token is invalid or expired.' }, { status: 401 })
      }
      if (verifiedToken.slug !== clinicSlug) {
        return NextResponse.json({ error: 'Widget access token does not match this clinic.' }, { status: 403 })
      }

      // Distributed rate limit before expensive work
      const effectiveVisitorId = visitorId || getClientIp(request.headers)
      const ip = getClientIp(request.headers)
      const chatPreset = widgetChatKey(effectiveVisitorId, ip)
      const rateLimit = await consumeDistributedRateLimit(chatPreset.key, chatPreset.limit, chatPreset.windowMs)
      if (!rateLimit.allowed) {
        const response = NextResponse.json(
          { error: 'Too many messages. Please slow down.' },
          { status: 429 },
        )
        response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
        return response
      }
    }

    // Build dynamic system prompt with clinic context and knowledge retrieval
    const {
      systemPrompt,
      userId,
      afterHours,
      clinicSettings,
      aiProfile,
      knowledgeChunks,
      supportLevel,
    } = await buildSystemPrompt({
      message,
      clinicId: clinicId ? String(clinicId) : null,
      clinicSlug: clinicSlug ? String(clinicSlug) : null,
      preview: Boolean(preview),
    })

    // For public path with clinicId: validate clinic is live + widget enabled
    const pathType = resolveChatPathType({
      clinicId: clinicId ? String(clinicId) : null,
      clinicSlug: clinicSlug ? String(clinicSlug) : null,
      preview: Boolean(preview),
    })
    const isPublicPath = pathType === 'public'
    const requiresAuthenticatedAccess = pathType === 'preview' || pathType === 'dashboard'

    if (requiresAuthenticatedAccess && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((clinicId || clinicSlug) && !aiProfile) {
      return NextResponse.json(
        { error: 'Widget is unavailable for this clinic.' },
        { status: 404 },
      )
    }

    const adminClient = createSupabaseAdminClient()

    // ── Resolve or create conversation ──────────────────────────
    let conversation: { id: string; clinic_id: string; public_token_hash: string | null }
    let isNewConversation = false
    let sessionToken: string | null = null

    if (conversationId) {
      // Resume existing conversation - validate access
      const isPreviewPath = preview && userId

      if (isPreviewPath) {
        // Preview/admin: validate membership
        const { data: membership } = await adminClient
          .from('clinic_members')
          .select('clinic_id')
          .eq('clinic_id', aiProfile?.clinic_id ?? '')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle()

        if (!membership) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const { data: conv } = await adminClient
          .from('conversations')
          .select('id, clinic_id, public_token_hash')
          .eq('id', conversationId)
          .eq('clinic_id', aiProfile?.clinic_id)
          .maybeSingle()

        if (!conv) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }
        conversation = conv
      } else if (isPublicPath) {
        // Public: validate via explicit token first (primary), then cookie (fallback)
        const effectiveClinicId = aiProfile?.clinic_id
        let conv: { id: string; clinic_id: string; public_token_hash: string | null } | null = null

        if (publicSessionToken && effectiveClinicId) {
          // Primary path: explicit token from host-page session handoff
          conv = await validatePublicSessionToken({
            conversationId,
            publicSessionToken,
            expectedClinicId: effectiveClinicId,
          })
        }

        if (!conv) {
          // Fallback: try cookie-based token (with expiry enforcement)
          const cookieStore = await cookies()
          const rawToken = cookieStore.get(CHAT_SESSION_COOKIE)?.value
          if (rawToken && effectiveClinicId) {
            const cookieConv = await validateCookieTokenFallback({
              conversationId,
              rawToken,
              expectedClinicId: effectiveClinicId,
            })
            conv = cookieConv
          }
        }

        if (!conv) {
          return NextResponse.json({ error: 'Session expired. Please start a new conversation.' }, { status: 401 })
        }
        conversation = conv
      } else {
        // Dashboard authenticated path
        const { data: conv } = await adminClient
          .from('conversations')
          .select('id, clinic_id, public_token_hash')
          .eq('id', conversationId)
          .maybeSingle()

        if (!conv) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Verify the user has access to this clinic
        if (userId) {
          const { data: membership } = await adminClient
            .from('clinic_members')
            .select('clinic_id')
            .eq('clinic_id', conv.clinic_id)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle()

          if (!membership) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
          }
        }

        conversation = conv
      }
    } else {
      // Create new conversation
      isNewConversation = true
      const effectiveClinicId = aiProfile?.clinic_id
      if (!effectiveClinicId) {
        return NextResponse.json({ error: 'Clinic context required.' }, { status: 400 })
      }

      let tokenHash: string | null = null
      if (isPublicPath) {
        sessionToken = mintSessionToken()
        tokenHash = hashSessionToken(sessionToken)
      }

      const { data: conv, error: createError } = await adminClient
        .from('conversations')
        .insert({
          clinic_id: effectiveClinicId,
          channel: 'web',
          status: 'active',
          subject: message.slice(0, 100),
          source_page: '/',
          helpful_status: 'unreviewed',
          needs_improvement: false,
          lead_captured: false,
          appointment_requested: false,
          public_token_hash: tokenHash,
          public_token_expires_at: tokenHash
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
          visitor_id: visitorId || null,
          visitor_name: null,
          last_message_at: new Date().toISOString(),
        })
        .select('id, clinic_id, public_token_hash')
        .single()

      if (createError || !conv) {
        throw createError || new Error('Failed to create conversation')
      }
      conversation = conv
    }

    // ── Save user message ──────────────────────────────────────
    const { data: userMessage, error: msgError } = await adminClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      })
      .select('id')
      .single()

    if (msgError || !userMessage) {
      throw msgError || new Error('Failed to save user message')
    }

    // ── Load conversation history ──────────────────────────────
    const { data: historyMessages } = await adminClient
      .from('conversation_messages')
      .select('id, role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    // ── Build LLM messages (widget public path: last 10 only) ─────
    const llmMessages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    const historyFiltered = (historyMessages ?? [])
      .filter((m) => m.id !== userMessage.id)
      .map((m) => ({
        role: m.role as 'user' | 'system' | 'assistant',
        content: m.content,
      }))

    // For public widget path, keep only last 10 messages to control context size
    if (isPublicPath) {
      const recentHistory = historyFiltered.slice(-10)
      llmMessages.push(...recentHistory)
    } else {
      llmMessages.push(...historyFiltered)
    }
    llmMessages.push({ role: 'user', content: message })

    // ── Load lead automation settings and extract fields ──────
    const leadSettings = await loadLeadSettings(adminClient, conversation.clinic_id)
    const transcriptLines = [
      ...(historyMessages ?? []).map((row) => `${row.role}: ${row.content}`),
      `user: ${message}`,
    ]
    const automationMessageCount = historyMessages?.length ?? 0

    const extractedFields = extractAutomationFields(transcriptLines)

    const { data: currentConversationStateRow } = await adminClient
      .from('conversations')
      .select('automation_state')
      .eq('id', conversation.id)
      .single()

    let automationState = mergeAutomationState(
      currentConversationStateRow?.automation_state,
      extractedFields,
    )

    // ── Call LLM ───────────────────────────────────────────────
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: llmMessages,
      thinking: { type: 'disabled' },
    })

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I was unable to generate a response. Please try again.'
    const finalResponse = buildSafeAssistantReply({
      aiResponse,
      supportLevel,
      latestUserMessage: message,
      fallbackMessage:
        aiProfile?.fallback_message ||
        "I'm not fully sure about that. Please contact the clinic directly so staff can help you correctly.",
    })

    // ── Save assistant message ─────────────────────────────────
    const { data: assistantMessage, error: assistMsgError } = await adminClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: finalResponse,
      })
      .select('id')
      .single()

    if (assistMsgError || !assistantMessage) {
      throw assistMsgError || new Error('Failed to save assistant message')
    }

    const lowerMessage = message.toLowerCase()

    // ── Idempotent lead creation ────────────────────────────────
    if (
      shouldCreateLead({
        settings: leadSettings,
        state: automationState,
        messageCount: automationMessageCount,
        latestUserMessage: lowerMessage,
        supportLevel,
      })
    ) {
      const automationKey = `${conversation.id}:lead:v1`

      const { data: lead, error: leadError } = await adminClient
        .from('leads')
        .upsert(
          {
            clinic_id: conversation.clinic_id,
            conversation_id: conversation.id,
            name: automationState.fields.name || 'Website visitor',
            phone: automationState.fields.phone,
            email: automationState.fields.email || null,
            question: message,
            source: 'chatbot',
            status: 'new',
            automation_key: automationKey,
          },
          { onConflict: 'clinic_id,automation_key' },
        )
        .select('id')
        .single()

      if (leadError) {
        throw leadError
      }

      automationState = {
        ...automationState,
        leadId: lead.id,
      }
    }

    // ── Idempotent appointment-request creation ─────────────────
    if (shouldCreateAppointmentRequest({ state: automationState, transcriptLines })) {
      const automationKey = `${conversation.id}:appointment:v1`

      const { data: appointmentRequest, error: appointmentError } = await adminClient
        .from('appointment_requests')
        .upsert(
          {
            clinic_id: conversation.clinic_id,
            conversation_id: conversation.id,
            lead_id: automationState.leadId,
            name: automationState.fields.name || 'Website visitor',
            phone: automationState.fields.phone,
            email: automationState.fields.email || null,
            preferred_date: automationState.fields.preferredDate,
            preferred_time: automationState.fields.preferredTime,
            reason: automationState.fields.reason || message,
            preferred_doctor: automationState.fields.preferredDoctor || null,
            status: 'requested',
            source: 'chatbot',
            automation_key: automationKey,
          },
          { onConflict: 'clinic_id,automation_key' },
        )
        .select('id')
        .single()

      if (appointmentError) {
        throw appointmentError
      }

      automationState = {
        ...automationState,
        appointmentRequestId: appointmentRequest.id,
      }
    }

    // ── Update conversation metadata ───────────────────────────
    const { count: messageCount } = await adminClient
      .from('conversation_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)

    await adminClient
      .from('conversations')
      .update({
        message_count: messageCount ?? 0,
        last_message: finalResponse.slice(0, 200),
        last_message_at: new Date().toISOString(),
        appointment_requested: Boolean(automationState.appointmentRequestId),
        lead_captured: Boolean(automationState.leadId),
        automation_state: automationState,
        visitor_name: automationState.fields.name || null,
      })
      .eq('id', conversation.id)

    // Extend token expiry on valid public activity
    if (isPublicPath && conversationId) {
      await extendTokenExpiry(conversation.id)
    }

    // ── Save citations ─────────────────────────────────────────
    const citations: CitationRow[] = knowledgeChunks.map((chunk) => {
      const sourceLabel =
        chunk.source_type === 'faq'
          ? `FAQ: ${chunk.knowledge_sources.title}`
          : chunk.source_type === 'manual_text'
            ? chunk.knowledge_sources.title
            : chunk.source_type === 'file_upload'
              ? chunk.file_name || chunk.knowledge_sources.title
              : chunk.page_title || chunk.knowledge_sources.title

      return {
        chunkId: chunk.id,
        sourceType: chunk.source_type,
        sourceTitle: sourceLabel,
        retrievalScore: chunk.retrieval_score ?? 0,
        scoreType: (chunk.score_type ?? 'lexical') as CitationRow['scoreType'],
      }
    })

    if (citations.length > 0 && assistantMessage) {
      const citationInserts = citations.map((c) => ({
        message_id: assistantMessage.id,
        conversation_id: conversation.id,
        chunk_id: c.chunkId,
        source_type: c.sourceType,
        source_title: c.sourceTitle,
        retrieval_score: c.retrievalScore,
        score_type: c.scoreType,
      }))

      await adminClient
        .from('message_citations')
        .insert(citationInserts)
    }

    // ── Unanswered detection ───────────────────────────────────
    const unansweredReason = detectUnansweredReason(
      supportLevel,
      message,
      finalResponse,
      knowledgeChunks.length > 0,
    )

    const needsImprovement = supportLevel === 'weak' || (supportLevel === 'medium' && unansweredReason !== null)

    if (unansweredReason) {
      // Deduplicate: check for same open question in this clinic
      const { data: existing } = await adminClient
        .from('unanswered_questions')
        .select('id')
        .eq('clinic_id', conversation.clinic_id)
        .eq('question', message.trim())
        .eq('status', 'open')
        .maybeSingle()

      if (!existing) {
        await adminClient
          .from('unanswered_questions')
          .insert({
            clinic_id: conversation.clinic_id,
            conversation_id: conversation.id,
            question: message.trim(),
            source_page: '/',
            reason: unansweredReason,
            status: 'open',
          })
      }

      // Update needs_improvement flag
      await adminClient
        .from('conversations')
        .update({ needs_improvement: true })
        .eq('id', conversation.id)
    }

    // ── Build response ─────────────────────────────────────────
    const responseBody: Record<string, unknown> = {
      answer: finalResponse,
      response: finalResponse,       // backward compat
      reply: finalResponse,          // backward compat
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      isAfterHours: afterHours,
      knowledgeHitCount: knowledgeChunks.length,
      supportLevel,
      clinicSettings,
      citations,
    }

    // Return publicSessionToken only when new conversation created (for host-page storage)
    if (isNewConversation && sessionToken) {
      responseBody.publicSessionToken = sessionToken
    }

    const response = NextResponse.json(responseBody)

    // Set session cookie for new public conversations (progressive enhancement fallback)
    if (isNewConversation && sessionToken) {
      response.cookies.set(CHAT_SESSION_COOKIE, sessionToken, getChatSessionCookieOptions())
    }

    return response
  } catch (error) {
    console.error('Error in chat endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 },
    )
  }
}
