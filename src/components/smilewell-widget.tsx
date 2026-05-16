'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  X,
  Calendar,
  Phone,
  User,
  Clock,
  Shield,
  Sparkles,
  MessageCircle,
  Smile,
  ChevronDown,
  MapPin,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'bot' | 'user'
  content: string
  timestamp: string
  showForm?: boolean
  showQuickActions?: boolean
}

interface WidgetQuickPrompt {
  label: string
  intent?: string | null
}

interface WidgetPublicConfig {
  widgetTitle?: string
  welcomeMessage?: string
  primaryColor?: string
  showWhatsappButton?: boolean
  showCallButton?: boolean
  showLocationButton?: boolean
  whatsappLink?: string | null
  phoneLink?: string | null
  mapsLink?: string | null
  quickPrompts?: WidgetQuickPrompt[]
}

// ─── AI Assistant Icon ────────────────────────────────────────
function BotIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Friendly AI face */}
      <circle cx="32" cy="34" r="22" fill="white" />
      {/* Antenna */}
      <rect x="30" y="6" width="4" height="10" rx="2" fill="white" />
      <circle cx="32" cy="5" r="3.5" fill="#FCD34D" />
      {/* Eyes */}
      <circle cx="24" cy="30" r="3" fill="#1E293B" />
      <circle cx="40" cy="30" r="3" fill="#1E293B" />
      {/* Happy mouth */}
      <path d="M24 38Q32 46 40 38" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─── Appointment Form ───────────────────────────────────────────
function AppointmentForm({ onSubmit, primaryColor }: { onSubmit: (data: Record<string, string>) => void; primaryColor: string }) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    date: '',
    time: '',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 mt-2 max-w-md mx-auto"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-black" />
        </div>
        <div>
          <h3 className="text-[#1a365d] font-bold text-base">Request Appointment</h3>
          <p className="text-gray-400 text-xs">We'll submit your request and the clinic will confirm.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.time}
            onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSubmit(form)}
        className="w-full py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition-all text-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <Calendar className="w-4 h-4" />
        Request Appointment
      </motion.button>
      <div className="flex items-center gap-1.5 mt-3 justify-center">
        <Shield className="w-3 h-3 text-gray-400" />
        <span className="text-[11px] text-gray-400">Your information is secure and confidential.</span>
      </div>
    </motion.div>
  )
}

// ─── Quick-prompt intent normalizer ─────────────────────────────
const normalizeQuickPromptIntent = (intent?: string | null) => {
  switch (intent) {
    case 'book_appointment':
    case 'appointment_request':
      return 'appointment'
    case 'services':
    case 'services_fees':
      return 'services'
    case 'location':
      return 'location'
    case 'talk_on_whatsapp':
      return 'whatsapp'
    case 'clinic_hours':
      return 'hours'
    case 'emergency_help':
      return 'emergency'
    default:
      return 'message'
  }
}

// ─── Initial Messages ───────────────────────────────────────────
const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'bot',
    content:
      "Hi there! I'm the dental assistant. I can help with appointments, services, clinic hours, and location. **How can I help you today?**",
    timestamp: '10:30 AM',
    showQuickActions: true,
  },
]

// ─── Widget Component ───────────────────────────────────────────
export default function SmileWellWidget({
  embedded = false,
  clinicId = null,
  clinicSlug = null,
  preview = false,
  sessionHandoff = false,
}: {
  embedded?: boolean
  clinicId?: string | null
  clinicSlug?: string | null
  preview?: boolean
  sessionHandoff?: boolean
}) {
  const shouldSkipParentHandoff =
    (!clinicId && !clinicSlug) ||
    !!preview ||
    !sessionHandoff ||
    (typeof window !== 'undefined' && window.parent === window)

  const [isOpen, setIsOpen] = useState(embedded)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [publicSessionToken, setPublicSessionToken] = useState<string | null>(null)
  const [sessionHydrated, setSessionHydrated] = useState(shouldSkipParentHandoff)
  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [widgetAccessToken, setWidgetAccessToken] = useState<string | null>(null)
  const [widgetConfig, setWidgetConfig] = useState<WidgetPublicConfig>({
    widgetTitle: 'Dental Assistant',
    welcomeMessage:
      "Hi there! I'm the dental assistant. I can help with appointments, services, clinic hours, and location. How can I help you today?",
    primaryColor: '#059669',
    quickPrompts: [
      { label: 'Book Appointment', intent: 'appointment_request' },
      { label: 'Services', intent: 'services' },
      { label: 'Ask a Question', intent: 'general' },
    ],
    showWhatsappButton: false,
    showCallButton: false,
    showLocationButton: false,
    whatsappLink: null,
    phoneLink: null,
    mapsLink: null,
  })
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSendingRef = useRef(false)
  const parentOriginRef = useRef<string | null>(null)
  const primaryColor = widgetConfig.primaryColor || '#059669'

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const applyWidgetConfig = useCallback((nextConfig?: WidgetPublicConfig | null) => {
    if (!nextConfig) return
    setWidgetConfig((prev) => ({
      ...prev,
      ...nextConfig,
      quickPrompts:
        nextConfig.quickPrompts && nextConfig.quickPrompts.length > 0
          ? nextConfig.quickPrompts
          : prev.quickPrompts,
    }))
  }, [])

  // ── postMessage: hydrate session from parent on mount ──────
  // The parent frame is on a different origin (third-party embed),
  // so we cannot use window.location.origin as either the receive
  // filter or the targetOrigin.
  //
  // Protocol:
  //  1. Iframe sends "ready" with targetOrigin '*' (no secrets yet).
  //  2. Parent responds with "hydrate" / "clear_session".
  //  3. On first valid parent message we lock the parent origin
  //     and verify it on every subsequent message.
  useEffect(() => {
    if (shouldSkipParentHandoff) {
      return
    }

    parentOriginRef.current = null
    let timeoutId: ReturnType<typeof setTimeout>

    function handleMessage(event: MessageEvent) {
      // Only accept messages from the parent window
      if (event.source !== window.parent) return
      if (!event.data || typeof event.data.type !== 'string') return

      // Lock parent origin on first valid message
      if (!parentOriginRef.current) {
        parentOriginRef.current = event.origin
      }

      // Reject if origin changes mid-session
      if (event.origin !== parentOriginRef.current) return

      if (event.data.type === 'clinic_widget:hydrate') {
        const payload = event.data.payload
        if (payload?.conversationId && payload?.publicSessionToken) {
          setConversationId(payload.conversationId)
          setPublicSessionToken(payload.publicSessionToken)
        }
        // Store visitorId and widgetAccessToken from parent
        if (payload?.visitorId) {
          setVisitorId(payload.visitorId)
        }
        if (payload?.widgetAccessToken) {
          setWidgetAccessToken(payload.widgetAccessToken)
        }
        if (payload?.widgetConfig) {
          applyWidgetConfig(payload.widgetConfig)
        }
        setSessionHydrated(true)
        // Don't remove listener — token_refresh still needs it
        // But stop the timeout since parent responded
        clearTimeout(timeoutId)
        return
      }

      if (event.data.type === 'clinic_widget:clear_session') {
        setConversationId(null)
        setPublicSessionToken(null)
        setSessionHydrated(true)
        clearTimeout(timeoutId)
        return
      }

      // Token refresh: parent re-bootstrapped and sends a fresh token
      if (event.data.type === 'clinic_widget:token_refresh') {
        const newToken = event.data.payload?.widgetAccessToken
        if (newToken) {
          setWidgetAccessToken(newToken)
        }
        if (event.data.payload?.widgetConfig) {
          applyWidgetConfig(event.data.payload.widgetConfig)
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Tell parent we're ready (targetOrigin '*' because we don't
    // know the parent's origin yet; the "ready" message carries
    // no sensitive data).
    window.parent.postMessage(
      { type: 'clinic_widget:ready', payload: { clinicId } },
      '*',
    )

    // Timeout: if no parent response, continue with empty state
    timeoutId = setTimeout(() => {
      setSessionHydrated(true)
    }, 2000)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('message', handleMessage)
    }
  }, [shouldSkipParentHandoff, clinicId, clinicSlug, applyWidgetConfig])

  // ── Send state_updated to parent when session changes ────────
  // Once the parent origin is known, send token-bearing messages to
  // that exact origin instead of '*'. We keep the initial ready
  // handshake permissive because no secrets are sent there.
  useEffect(() => {
    if ((!clinicId && !clinicSlug) || preview) return
    if (!conversationId || !publicSessionToken) return

    const targetOrigin = parentOriginRef.current ?? '*'

    window.parent.postMessage(
      {
        type: 'clinic_widget:state_updated',
        payload: {
          conversationId,
          publicSessionToken,
          clinicId,
          clinicSlug,
          updatedAt: new Date().toISOString(),
        },
      },
      targetOrigin,
    )
  }, [conversationId, publicSessionToken, clinicId, clinicSlug, preview])

  // ── Handle session expiry from backend ───────────────────────
  const handleSessionExpired = useCallback(() => {
    setConversationId(null)
    setPublicSessionToken(null)

    // Notify parent to clear stored session
    if ((clinicId || clinicSlug) && !preview) {
      const targetOrigin = parentOriginRef.current ?? '*'
      window.parent.postMessage(
        { type: 'clinic_widget:start_new_session', payload: { clinicId, clinicSlug } },
        targetOrigin,
      )
    }
  }, [clinicId, clinicSlug, preview])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400)
    }
  }, [isOpen])

  const getCurrentTime = () => {
    const now = new Date()
    let hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours}:${minutes} ${ampm}`
  }

  useEffect(() => {
    if (conversationId) return
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.id !== 'welcome') return prev
      return [
        {
          id: 'welcome',
          role: 'bot',
          content: widgetConfig.welcomeMessage || initialMessages[0].content,
          timestamp: getCurrentTime(),
          showQuickActions: true,
        },
      ]
    })
  }, [conversationId, widgetConfig.welcomeMessage])

  // ── Load real saved config in preview mode ──────────────────────
  useEffect(() => {
    if (!preview || !clinicId) return

    let cancelled = false

    async function loadPreviewConfig() {
      try {
        const [settingsRes, promptsRes, clinicRes] = await Promise.all([
          fetch('/api/widget-settings', { cache: 'no-store' }),
          fetch('/api/widget-settings/quick-prompts', { cache: 'no-store' }),
          fetch('/api/clinic', { cache: 'no-store' }),
        ])

        if (!settingsRes.ok || !promptsRes.ok) return

        const settings = await settingsRes.json()
        const prompts = await promptsRes.json()
        const clinic = clinicRes.ok ? await clinicRes.json() : null

        if (cancelled) return

        setWidgetConfig((prev) => ({
          ...prev,
          widgetTitle: settings.botName || prev.widgetTitle,
          welcomeMessage: settings.welcomeMessage || prev.welcomeMessage,
          primaryColor: settings.primaryColor || prev.primaryColor,
          showWhatsappButton: !!(clinic?.whatsappNumber || clinic?.whatsapp),
          showCallButton: !!(clinic?.primaryPhone || clinic?.phone),
          showLocationButton: !!(clinic?.mapLink || clinic?.google_maps_url),
          whatsappLink: (clinic?.whatsappNumber || clinic?.whatsapp)
            ? `https://wa.me/${(clinic.whatsappNumber || clinic.whatsapp).replace(/^\+/, '')}`
            : null,
          phoneLink: clinic?.primaryPhone || clinic?.phone || null,
          mapsLink: clinic?.mapLink || clinic?.google_maps_url || null,
          quickPrompts:
            Array.isArray(prompts) && prompts.length > 0
              ? prompts
                  .filter((prompt: { isActive?: boolean }) => prompt.isActive !== false)
                  .map((prompt: { label: string; intent?: string | null }) => ({
                    label: prompt.label,
                    intent: prompt.intent ?? null,
                  }))
              : prev.quickPrompts,
        }))
      } catch {
        // keep defaults in preview if preview data fails
      }
    }

    void loadPreviewConfig()

    return () => {
      cancelled = true
    }
  }, [preview, clinicId])

  const logWidgetEvent = useCallback(
    async (eventType: string, metadata?: Record<string, unknown>) => {
      if (!clinicSlug || !widgetAccessToken || preview) return

      try {
        await fetch('/api/analytics/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'widget',
            eventType,
            clinicSlug,
            widgetAccessToken,
            visitorId,
            conversationId: conversationId || undefined,
            publicSessionToken: publicSessionToken || undefined,
            metadata: metadata || undefined,
          }),
        })
      } catch {
        // Event logging should never block UX.
      }
    },
    [clinicSlug, widgetAccessToken, visitorId, conversationId, publicSessionToken, preview],
  )

  const requestFreshWidgetToken = useCallback(async () => {
    if (!(clinicId || clinicSlug) || preview || window.parent === window) {
      return null
    }

    const targetOrigin = parentOriginRef.current ?? '*'
    window.parent.postMessage(
      { type: 'clinic_widget:token_expired', payload: { clinicSlug } },
      targetOrigin,
    )

    return await new Promise<string | null>((resolve) => {
      let settled = false
      const cleanup = () => {
        window.removeEventListener('message', handler)
        clearTimeout(timer)
      }
      const finish = (value: string | null) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      }
      const handler = (event: MessageEvent) => {
        if (event.source !== window.parent) return
        if (parentOriginRef.current && event.origin !== parentOriginRef.current) return
        if (event.data?.type !== 'clinic_widget:token_refresh') return
        finish(event.data.payload?.widgetAccessToken || null)
      }
      const timer = setTimeout(() => finish(null), 5000)
      window.addEventListener('message', handler)
    })
  }, [clinicId, clinicSlug, preview])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    if (!sessionHydrated) return // Wait for parent handoff before sending
    // Concurrency guard: prevent double-submit via rapid clicks/Enter
    if (isSendingRef.current) return
    isSendingRef.current = true

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: getCurrentTime(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)
    void logWidgetEvent('message_sent', { textLength: text.trim().length })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          clinicId,
          clinicSlug,
          widgetAccessToken,
          visitorId,
          preview,
          conversationId: conversationId || undefined,
          publicSessionToken: publicSessionToken || undefined,
        }),
      })
      const data = await res.json()

      // Handle 401 — token expired or session expired
      if (res.status === 401) {
        // Try token refresh via parent
        const refreshed = await requestFreshWidgetToken()

        if (refreshed) {
          // Retry with the new token
          const retryRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text.trim(),
              clinicSlug,
              widgetAccessToken: refreshed,
              visitorId,
              conversationId: conversationId || undefined,
              publicSessionToken: publicSessionToken || undefined,
            }),
          })
          const retryData = await retryRes.json()
          if (retryRes.ok) {
            if (retryData.conversationId) setConversationId(retryData.conversationId)
            if (retryData.publicSessionToken) setPublicSessionToken(retryData.publicSessionToken)
            void logWidgetEvent('answer_received', { retried: true })
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: retryData.response || retryData.reply || retryData.answer || "I'm sorry, I couldn't process that.",
                timestamp: getCurrentTime(),
              },
            ])
            return
          }
        }

        // Fallback: clear session and show error
        handleSessionExpired()
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'bot',
            content: "Your session has expired. Please start a new conversation.",
            timestamp: getCurrentTime(),
          },
        ])
        return
      }

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }
      // Store new session token from backend
      if (data.publicSessionToken) {
        setPublicSessionToken(data.publicSessionToken)
      }
      void logWidgetEvent('answer_received', { retried: false })
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: data.response || data.reply || data.answer || "I'm sorry, I couldn't process that.",
          timestamp: getCurrentTime(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: "I'm sorry, something went wrong.",
          timestamp: getCurrentTime(),
        },
      ])
    } finally {
      setIsTyping(false)
      isSendingRef.current = false
    }
  }

  const handleQuickAction = (prompt: { label: string; intent?: string | null }) => {
    void logWidgetEvent('quick_prompt_clicked', {
      label: prompt.label,
      intent: prompt.intent ?? null,
    })

    const intent = normalizeQuickPromptIntent(prompt.intent)

    if (intent === 'appointment') {
      setShowAppointmentForm(true)
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: prompt.label, timestamp: getCurrentTime() },
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: "Great! Please share your details below and we'll help you schedule your appointment. 😊",
          timestamp: getCurrentTime(),
          showForm: true,
        },
      ])
      return
    }

    if (intent === 'whatsapp') {
      openWidgetActionLink('whatsapp')
      return
    }

    if (intent === 'location') {
      openWidgetActionLink('maps')
      return
    }

    void sendMessage(prompt.label)
  }

  const openWidgetActionLink = (kind: 'whatsapp' | 'call' | 'maps') => {
    const rawLink =
      kind === 'whatsapp'
        ? widgetConfig.whatsappLink
        : kind === 'call'
          ? widgetConfig.phoneLink
          : widgetConfig.mapsLink

    if (!rawLink) return

    const finalLink =
      kind === 'call' && !rawLink.startsWith('tel:')
        ? `tel:${rawLink}`
        : rawLink

    void logWidgetEvent(
      kind === 'whatsapp'
        ? 'whatsapp_click'
        : kind === 'call'
          ? 'call_click'
          : 'location_click',
      { link: finalLink },
    )

    if (kind === 'call') {
      window.location.href = finalLink
      return
    }

    window.open(finalLink, '_blank', 'noopener,noreferrer')
  }

  const handleFormSubmit = async (formData: Record<string, string>) => {
    if (!formData.fullName.trim() || !formData.phone.trim()) return

    const buildBody = (token: string | null) => JSON.stringify({
      clinicSlug,
      widgetAccessToken: token,
      visitorId,
      conversationId: conversationId || undefined,
      publicSessionToken: publicSessionToken || undefined,
      name: formData.fullName,
      phone: formData.phone,
      preferredDate: formData.date,
      preferredTime: formData.time,
      reason: 'Appointment request from chat widget',
      source: 'widget',
    })

    try {
      let res = await fetch('/api/appointment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildBody(widgetAccessToken),
      })

      // On 401, try token refresh and retry once
      if (res.status === 401) {
        const refreshed = await requestFreshWidgetToken()
        if (refreshed) {
          res = await fetch('/api/appointment-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: buildBody(refreshed),
          })
        }
      }

      if (res.ok) {
        void logWidgetEvent('appointment_request', { source: 'chat_form' })
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: 'bot',
            content: `Your appointment request has been submitted. The clinic will contact you to confirm.\n\n**Name:** ${formData.fullName}\n**Phone:** ${formData.phone}\n**Date:** ${formData.date}\n**Time:** ${formData.time}`,
            timestamp: getCurrentTime(),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: 'bot',
            content: "Sorry, we couldn't submit your request right now. Please try again or contact the clinic directly.",
            timestamp: getCurrentTime(),
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'bot',
          content: "Sorry, something went wrong. Please try again or contact the clinic directly.",
          timestamp: getCurrentTime(),
        },
      ])
    }
  }

  const handleCloseWidget = () => {
    if (embedded && window.parent !== window) {
      const targetOrigin = parentOriginRef.current ?? '*'
      window.parent.postMessage(
        { type: 'clinic_widget:close_requested', payload: { clinicSlug } },
        targetOrigin,
      )
      return
    }

    setIsOpen(false)
  }

  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      }
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
      ))
    })
  }

  return (
    <div className={embedded ? "flex flex-col h-full" : "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"}>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: 'bottom right' }}
            className={embedded
                ? "w-full h-full bg-white flex flex-col overflow-hidden border border-gray-100"
                : "w-[380px] h-[520px] bg-white rounded-3xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden border border-gray-100"
            }
          >
            {/* Header */}
            <div
              className="relative px-5 py-4 flex items-center gap-3 flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="absolute bottom-0 left-0 right-0">
                <svg viewBox="0 0 400 20" fill="none" className="w-full">
                  <path d="M0 20C50 8 100 2 200 10C300 18 350 5 400 20V20H0Z" fill="white" />
                </svg>
              </div>
              <Sparkles className="absolute top-3 right-16 w-4 h-4 text-yellow-200/60" />
              <Sparkles className="absolute bottom-8 left-8 w-3 h-3 text-yellow-200/40" />
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <BotIcon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight">
                  {widgetConfig.widgetTitle || 'Dental Assistant'}
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-white/80 text-xs flex items-center gap-1">
                    Online now <Smile className="w-3 h-3 inline" />
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseWidget}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="Minimize chat"
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleCloseWidget}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {(widgetConfig.showWhatsappButton || widgetConfig.showCallButton || widgetConfig.showLocationButton) && (
              <div className="border-b border-gray-100 px-4 py-3 bg-white flex gap-2 overflow-x-auto">
                {widgetConfig.showWhatsappButton && widgetConfig.whatsappLink && (
                  <button
                    type="button"
                    onClick={() => openWidgetActionLink('whatsapp')}
                    className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    WhatsApp
                  </button>
                )}
                {widgetConfig.showCallButton && widgetConfig.phoneLink && (
                  <button
                    type="button"
                    onClick={() => openWidgetActionLink('call')}
                    className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Call
                  </button>
                )}
                {widgetConfig.showLocationButton && widgetConfig.mapsLink && (
                  <button
                    type="button"
                    onClick={() => openWidgetActionLink('maps')}
                    className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Location
                  </button>
                )}
              </div>
            )}

            {/* Chat Area */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
            >
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {msg.role === 'bot' ? (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <BotIcon size={16} />
                        </div>
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'text-white rounded-2xl rounded-tr-sm'
                            : 'bg-gray-100 text-gray-700 rounded-2xl rounded-tl-sm'
                        }`}
                        style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                      >
                        {renderContent(msg.content)}
                      </div>
                      {msg.showQuickActions && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {(widgetConfig.quickPrompts || []).map((prompt, index) => (
                            <motion.button
                              key={`${prompt.label}-${index}`}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleQuickAction(prompt)}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-md hover:brightness-110"
                              style={{ backgroundColor: primaryColor }}
                            >
                              {(() => {
                                const intent = normalizeQuickPromptIntent(prompt.intent)

                                if (intent === 'appointment') return <Calendar className="w-4 h-4" />
                                if (intent === 'services') return <Smile className="w-4 h-4" />
                                if (intent === 'location') return <MapPin className="w-4 h-4" />
                                if (intent === 'whatsapp') return <Phone className="w-4 h-4" />
                                return <MessageCircle className="w-4 h-4" />
                              })()}
                              {prompt.label}
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {msg.showForm && <AppointmentForm onSubmit={handleFormSubmit} primaryColor={primaryColor} />}
                      <div className={`flex items-center gap-1 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[11px] text-gray-400">{msg.timestamp}</span>
                        {msg.role === 'user' && (
                          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="text-gray-400">
                            <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                    <BotIcon size={16} />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage(inputValue)
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all placeholder:text-gray-400"
                />
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  disabled={!inputValue.trim() || isTyping || !sessionHydrated}
                  className="w-10 h-10 rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center shadow-md transition-colors"
                  style={{ backgroundColor: inputValue.trim() && !isTyping && sessionHydrated ? primaryColor : undefined }}
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button — only in popup mode */}
      {!embedded && (
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.button
            key="chat-btn"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl transition-shadow group"
            style={{ backgroundColor: primaryColor }}
            aria-label="Open chat"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
            </motion.div>
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">1</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      )}
    </div>
  )
}
