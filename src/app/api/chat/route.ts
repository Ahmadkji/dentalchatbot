import { type CurrentClinicAiProfile, getCurrentClinicAiProfile } from '@/lib/clinics/current'
import { formatServicePricingPrompt } from '@/lib/clinics/service-pricing'
import { formatClinicHoursSummary, isClinicOpenNow } from '@/lib/clinics/hours'
import { searchKnowledgeChunks } from '@/lib/knowledge/sources'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { getClinicFreemiusBillingStatus } from '@/lib/billing/freemius-server'
import { buildLeadGatePayload, LEAD_GATE_QUESTION, shouldRequireLeadGate } from '@/lib/chat/lead-gate'
import {
  mintSessionToken,
  hashSessionToken,
  CHAT_SESSION_COOKIE,
  getChatSessionCookieOptions,
  resolveChatPathType,
} from '@/lib/chat/session'
import { validatePublicSessionToken, validateCookieTokenFallback, extendTokenExpiry } from '@/lib/chat/public-widget-session'
import { publicSessionTokenSchema, uuidSchema, clinicSlugSchema, widgetAccessTokenSchema } from '@/lib/chat/widget-api-schemas'
import { verifyWidgetAccessToken, mintWidgetAccessToken } from '@/lib/widget/widget-access-token'
import { consumeDistributedRateLimit, widgetChatKey } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import {
  buildSafeAssistantReply,
  extractAutomationFields,
  mergeAutomationState,
  normalizeAutomationState,
  shouldCreateAppointmentRequest,
} from '@/lib/chat/automation'
import { generateAssistantReply } from '@/lib/ai/chat-provider'
import { detectUnansweredReason } from '@/lib/unanswered/detect'
import { normalizeUnansweredQuestion, unansweredQuestionKey } from '@/lib/unanswered/normalize'
import { leadCreateSchema, getLeadConflictMessage } from '@/lib/leads/lead-contract'
import { getLeadGateSettings } from '@/lib/leads/lead-gate-settings'
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

// ─── Prompt helpers (unchanged from original) ──────────────────

function formatPromptService(service: {
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

type RuntimeCustomizationSettings = {
  chatMode: 'human' | 'ai'
}

async function loadRuntimeCustomizationSettings(
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

// ─── POST handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      message,
      conversationId,
      clinicId,
      clinicSlug,
      preview,
      visitorId,
      publicSessionToken,
      widgetAccessToken,
      leadCaptureSubmission,
    } = body
    const messageText = typeof message === 'string' ? message : ''
    const sourcePage = typeof body.sourcePage === 'string' ? body.sourcePage.trim().slice(0, 500) : null
    const hasLeadCaptureSubmission = Boolean(
      leadCaptureSubmission &&
      typeof leadCaptureSubmission === 'object' &&
      !Array.isArray(leadCaptureSubmission),
    )

    if (!messageText && !hasLeadCaptureSubmission) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // Widget-specific tighter message limit (1000 chars)
    const isWidgetPublicPath = (clinicId || clinicSlug) && !preview
    if (messageText && isWidgetPublicPath && String(messageText).trim().length > 1000) {
      return NextResponse.json({ error: 'message is too long (max 1000 characters for widget)' }, { status: 400 })
    }

    if (messageText && String(messageText).trim().length > 4000) {
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
        return NextResponse.json({ error: 'Widget access token is required.', errorCode: 'WIDGET_TOKEN_MISSING' }, { status: 401 })
      }
      const verifiedToken = verifyWidgetAccessToken(widgetAccessToken)
      if (!verifiedToken) {
        return NextResponse.json({ error: 'Widget access token is invalid or expired.', errorCode: 'WIDGET_TOKEN_EXPIRED' }, { status: 401 })
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
      message: messageText,
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
      return NextResponse.json({ error: 'Unauthorized', errorCode: 'UNAUTHENTICATED' }, { status: 401 })
    }

    if ((clinicId || clinicSlug) && !aiProfile) {
      return NextResponse.json(
        { error: 'Widget is unavailable for this clinic.' },
        { status: 404 },
      )
    }

    const billingStatus = aiProfile?.clinic_id
      ? await getClinicFreemiusBillingStatus(aiProfile.clinic_id)
      : {
          features: {
            canCaptureLeads: false,
            canCreateAppointmentRequests: false,
          },
        }

    const adminClient = createSupabaseAdminClient()
    const { data: leadSettingRows } = aiProfile?.clinic_id
      ? await adminClient
          .from('clinic_settings')
          .select('key,value')
          .eq('clinic_id', aiProfile.clinic_id)
          .in('key', ['lead_collection_enabled', 'lead_required_fields'])
      : { data: [] as Array<{ key: string; value: string }> }
    const leadGateSettings = getLeadGateSettings(leadSettingRows ?? [])
    const leadGatePayload = buildLeadGatePayload({
      fields: leadGateSettings.requiredFields,
      prompt: leadGateSettings.prompt,
    })

    if (
      isPublicPath &&
      !conversationId &&
      shouldRequireLeadGate({
        canCaptureLeads: billingStatus.features.canCaptureLeads,
        leadCollectionEnabled: leadGateSettings.collectionEnabled,
        hasLeadCaptured: false,
        isPublicWidget: isPublicPath,
      }) &&
      !hasLeadCaptureSubmission
    ) {
      const requestOrigin = request.headers.get('origin')?.trim() || ''
      const responseBody: Record<string, unknown> = {
        error: 'Please share your contact details before starting the conversation.',
        errorCode: 'LEAD_GATE_REQUIRED',
        leadGateRequired: true,
        leadGate: leadGatePayload,
        supportLevel,
        clinicSettings,
      }

      if (clinicSlug) {
        responseBody.refreshedWidgetAccessToken = mintWidgetAccessToken(clinicSlug, requestOrigin)
      }

      return NextResponse.json(responseBody, { status: 403 })
    }
    // ── Resolve or create conversation ──────────────────────────
    let conversation: { id: string; clinic_id: string; public_token_hash: string | null; source_page: string | null; lead_captured: boolean }
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
          .select('id, clinic_id, public_token_hash, source_page, lead_captured')
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
        let conv: { id: string; clinic_id: string; public_token_hash: string | null; source_page: string | null; lead_captured: boolean } | null = null

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
          return NextResponse.json({ error: 'Session expired. Please start a new conversation.', errorCode: 'SESSION_EXPIRED' }, { status: 401 })
        }
        conversation = conv
      } else {
        // Dashboard authenticated path
        const { data: conv } = await adminClient
          .from('conversations')
          .select('id, clinic_id, public_token_hash, source_page, lead_captured')
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
          subject: (messageText.trim() || LEAD_GATE_QUESTION).slice(0, 100),
          source_page: sourcePage || '/',
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
          .select('id, clinic_id, public_token_hash, source_page, lead_captured')
        .single()

    if (createError || !conv) {
      throw createError || new Error('Failed to create conversation')
    }
    conversation = conv
  }

    const { data: currentConversationStateRow } = await adminClient
      .from('conversations')
      .select('automation_state')
      .eq('id', conversation.id)
      .single()

    if (
      shouldRequireLeadGate({
        canCaptureLeads: billingStatus.features.canCaptureLeads,
        leadCollectionEnabled: leadGateSettings.collectionEnabled,
        hasLeadCaptured: conversation.lead_captured,
        isPublicWidget: isPublicPath,
      }) &&
      !hasLeadCaptureSubmission
    ) {
      const requestOrigin = request.headers.get('origin')?.trim() || ''
      const responseBody: Record<string, unknown> = {
        error: 'Please share your contact details before starting the conversation.',
        errorCode: 'LEAD_GATE_REQUIRED',
        leadGateRequired: true,
        leadGate: leadGatePayload,
        supportLevel,
        clinicSettings,
      }

      if (clinicSlug) {
        responseBody.refreshedWidgetAccessToken = mintWidgetAccessToken(clinicSlug, requestOrigin)
      }

      return NextResponse.json(responseBody, { status: 403 })
    }

    if (hasLeadCaptureSubmission) {
      // Preview mode: authenticated admin is testing the widget flow.
      // Bypass the billing gate so the admin can preview what visitors see.
      // The real public widget is still gated by billing in the config route.
      const billingAllowed = pathType === 'preview' || billingStatus.features.canCaptureLeads
      if (!billingAllowed || !leadGateSettings.collectionEnabled) {
        return NextResponse.json(
          { error: 'Lead capture is not available for this clinic plan.' },
          { status: 403 },
        )
      }

      const submission = leadCaptureSubmission as Record<string, unknown>
      const submittedInquiry = typeof submission.inquiry === 'string' ? submission.inquiry.trim() : ''
      const submittedName = typeof submission.name === 'string' ? submission.name.trim() : ''
      const submittedPhone = typeof submission.phone === 'string' ? submission.phone.trim() : null
      const submittedEmail = typeof submission.email === 'string' ? submission.email.trim() : null
      const leadQuestion = submittedInquiry || LEAD_GATE_QUESTION

      const missingFields = leadGateSettings.requiredFields.filter((field) => {
        if (field === 'name') return !submittedName
        if (field === 'phone') return !submittedPhone
        if (field === 'email') return !submittedEmail
        return false
      })

      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: `${missingFields.join(', ')} ${missingFields.length === 1 ? 'is' : 'are'} required before starting the conversation.`,
            errorCode: 'LEAD_GATE_REQUIRED',
            leadGateRequired: true,
            leadGate: leadGatePayload,
          },
          { status: 400 },
        )
      }

      const leadInput = leadCreateSchema.safeParse({
        conversationId: conversation.id,
        name: submittedName,
        phone: submittedPhone,
        email: submittedEmail,
        question: leadQuestion,
        source: 'chatbot',
        preferredContact: submittedPhone ? 'phone' : 'email',
      })

      if (!leadInput.success) {
        return NextResponse.json(
          { error: leadInput.error.issues[0]?.message ?? 'Invalid lead payload' },
          { status: 400 },
        )
      }

      const automationKey = `${conversation.id}:lead:v1`
      const { data: lead, error: leadError } = await adminClient
        .from('leads')
        .upsert(
          {
            clinic_id: conversation.clinic_id,
            conversation_id: conversation.id,
            name: leadInput.data.name,
            phone: leadInput.data.phone,
            email: leadInput.data.email,
            question: leadInput.data.question,
            source: leadInput.data.source,
            status: leadInput.data.status,
            automation_key: automationKey,
          },
          { onConflict: 'clinic_id,automation_key' },
        )
        .select('id')
        .single()

      if (leadError) {
        const conflictMessage = getLeadConflictMessage(leadError)
        if (conflictMessage) {
          return NextResponse.json({ error: conflictMessage }, { status: 409 })
        }
        throw leadError
      }

      const conversationAutomationState = normalizeAutomationState(currentConversationStateRow?.automation_state)
      const nextAutomationState = {
        ...conversationAutomationState,
        leadId: lead.id,
        fields: {
          ...conversationAutomationState.fields,
          name: leadInput.data.name,
          phone: leadInput.data.phone || conversationAutomationState.fields.phone,
          email: leadInput.data.email || conversationAutomationState.fields.email,
        },
      }

      await adminClient
        .from('conversations')
        .update({
          lead_captured: true,
          last_message: 'Lead details submitted',
          visitor_name: nextAutomationState.fields.name || null,
          automation_state: nextAutomationState,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversation.id)

      if (isPublicPath && conversationId) {
        await extendTokenExpiry(conversation.id)
      }

      const responseBody: Record<string, unknown> = {
        answer: "Thanks for sharing your details. You're all set to keep chatting. Tell me what you'd like help with next, and I can guide you to the right service, answer questions, or help you take the next step with the clinic.",
        response: "Thanks for sharing your details. You're all set to keep chatting. Tell me what you'd like help with next, and I can guide you to the right service, answer questions, or help you take the next step with the clinic.",
        reply: "Thanks for sharing your details. You're all set to keep chatting. Tell me what you'd like help with next, and I can guide you to the right service, answer questions, or help you take the next step with the clinic.",
        conversationId: conversation.id,
        leadCaptured: true,
        leadId: lead.id,
        supportLevel,
        clinicSettings,
      }

      if (isNewConversation && sessionToken) {
        responseBody.publicSessionToken = sessionToken
      }

      if (isPublicPath && clinicSlug) {
        const requestOrigin = request.headers.get('origin')?.trim() || ''
        responseBody.refreshedWidgetAccessToken = mintWidgetAccessToken(clinicSlug, requestOrigin)
      }

      return NextResponse.json(responseBody)
    }

    // ── Save user message ──────────────────────────────────────
    const { data: userMessage, error: msgError } = await adminClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: messageText,
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
    llmMessages.push({ role: 'user', content: messageText })

    const runtimeCustomization = await loadRuntimeCustomizationSettings(adminClient, conversation.clinic_id)
    const canCreateAppointmentRequests = billingStatus.features.canCreateAppointmentRequests
    const transcriptLines = [
      ...(historyMessages ?? []).map((row) => `${row.role}: ${row.content}`),
      `user: ${messageText}`,
    ]
    let automationState = mergeAutomationState(
      currentConversationStateRow?.automation_state,
      extractAutomationFields(transcriptLines),
    )

    let aiResponse: string

    if (runtimeCustomization.chatMode === 'human') {
      aiResponse =
        "Thanks for your message. A human team member will reply shortly. I won't auto-answer in this chat mode."
    } else {
      aiResponse = await generateAssistantReply({
        messages: llmMessages,
      })
    }

    let finalResponse =
      runtimeCustomization.chatMode === 'human'
        ? aiResponse
        : buildSafeAssistantReply({
            aiResponse,
            supportLevel,
            latestUserMessage: messageText,
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

    // ── Idempotent appointment-request creation ─────────────────
    if (
      canCreateAppointmentRequests &&
      shouldCreateAppointmentRequest({ state: automationState, transcriptLines })
    ) {
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
            reason: automationState.fields.reason || messageText,
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
    const fallbackMessage =
      aiProfile?.fallback_message ||
      "I'm not fully sure about that. Please contact the clinic directly so staff can help you correctly."
    const unansweredReason = detectUnansweredReason({
      supportLevel,
      userMessage: messageText,
      aiResponse: finalResponse,
      hasRelevantChunks: knowledgeChunks.length > 0,
      fallbackMessage,
    })

    const needsImprovement = supportLevel === 'weak' || (supportLevel === 'medium' && unansweredReason !== null)

    if (unansweredReason) {
      // Deduplicate: check for same open question in this clinic
      const normalizedQuestion = normalizeUnansweredQuestion(messageText)
      const questionKey = unansweredQuestionKey(normalizedQuestion)
      const { data: existing, error: existingError } = await adminClient
        .from('unanswered_questions')
        .select('id, question')
        .eq('clinic_id', conversation.clinic_id)
        .eq('status', 'open')
      if (existingError) throw existingError
      const existingMatch = (existing ?? []).find((row: { question: string }) =>
        unansweredQuestionKey(row.question) === questionKey,
      )

      if (!existingMatch) {
        const { error: unansweredInsertError } = await adminClient
          .from('unanswered_questions')
          .insert({
            clinic_id: conversation.clinic_id,
            conversation_id: conversation.id,
            question: normalizedQuestion,
            source_page: conversation.source_page || '/',
            reason: unansweredReason,
            status: 'open',
          })
        if (unansweredInsertError && (unansweredInsertError as { code?: string }).code !== '23505') {
          throw unansweredInsertError
        }
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

    // Inline refresh: mint a fresh widget access token for public path responses
    // so the iframe/parent stay current without extra network calls.
    if (isPublicPath && clinicSlug) {
      const requestOrigin = request.headers.get('origin')?.trim() || ''
      responseBody.refreshedWidgetAccessToken = mintWidgetAccessToken(clinicSlug, requestOrigin)
    }

    const response = NextResponse.json(responseBody)

    // Set session cookie for new public conversations (progressive enhancement fallback)
    if (isNewConversation && sessionToken) {
      response.cookies.set(CHAT_SESSION_COOKIE, sessionToken, getChatSessionCookieOptions())
    }

    return response
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    // Don't re-log AI provider errors — they already log structured context at the source.
    // Only log non-AI errors (DB failures, auth, automation) that don't pass through the provider.
    const isAiProviderError =
      errorMsg.startsWith('OpenRouter chat failed') ||
      errorMsg === 'OpenRouter chat request timed out.'
    if (!isAiProviderError) {
      console.error('[chat:POST] Error in chat endpoint', {
        error: errorMsg,
      })
    }
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 },
    )
  }
}
