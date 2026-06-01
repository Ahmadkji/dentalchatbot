'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  buildLeadGatePayload,
} from '@/lib/chat/lead-gate'
import { WidgetView } from '@/components/smilewell-widget/components/widget-view'
import { useWidgetActions } from '@/components/smilewell-widget/hooks/use-widget-actions'
import { createInitialMessages, createInitialWidgetConfig, DEFAULT_WELCOME_MESSAGE } from '@/components/smilewell-widget/constants'
import { useWidgetAnalytics } from '@/components/smilewell-widget/hooks/use-widget-analytics'
import { useWidgetChat } from '@/components/smilewell-widget/hooks/use-widget-chat'
import { useWidgetParentHandoff } from '@/components/smilewell-widget/hooks/use-widget-parent-handoff'
import { useWidgetPreviewConfig } from '@/components/smilewell-widget/hooks/use-widget-preview-config'
import type { ChatMessage, WidgetProps, WidgetPublicConfig } from '@/components/smilewell-widget/types'
import { getDemoResponse } from '@/components/smilewell-widget/utils/demo-response'
import { getCurrentTime } from '@/components/smilewell-widget/utils/time'

// ─── Widget Component ───────────────────────────────────────────
export default function SmileWellWidget({
  embedded = false,
  clinicId = null,
  clinicSlug = null,
  preview = false,
  sessionHandoff = false,
}: WidgetProps) {
  const shouldSkipParentHandoff =
    (!clinicId && !clinicSlug) ||
    !!preview ||
    !sessionHandoff ||
    (typeof window !== 'undefined' && window.parent === window)

  const isPublicWidget = !!(clinicId || clinicSlug) && !preview
  const isDemoMode = !clinicId && !clinicSlug && !preview

  const [isOpen, setIsOpen] = useState(embedded)
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages(isDemoMode))
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [leadId, setLeadId] = useState<string | null>(null)
  const [publicSessionToken, setPublicSessionToken] = useState<string | null>(null)
  const [sessionHydrated, setSessionHydrated] = useState(shouldSkipParentHandoff)
  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [widgetAccessToken, setWidgetAccessToken] = useState<string | null>(null)
  const [widgetConfig, setWidgetConfig] = useState<WidgetPublicConfig>(createInitialWidgetConfig(isDemoMode))
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryColor = widgetConfig.primaryColor || '#059669'
  const showLeadGate = Boolean(widgetConfig.leadGateRequired) && !conversationId && sessionHydrated && !isDemoMode
  const leadGateCopy = widgetConfig.leadGate ?? buildLeadGatePayload()

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const applyWidgetConfig = useCallback((nextConfig?: WidgetPublicConfig | null) => {
    if (!nextConfig) return
    setWidgetConfig((prev) => ({
      ...prev,
      ...nextConfig,
      leadGateRequired: nextConfig.leadGateRequired ?? prev.leadGateRequired,
      leadGate: nextConfig.leadGate ?? prev.leadGate,
      quickPrompts:
        nextConfig.quickPrompts && nextConfig.quickPrompts.length > 0
          ? nextConfig.quickPrompts
          : prev.quickPrompts,
    }))
  }, [])

  const { logWidgetEvent } = useWidgetAnalytics({
    clinicId,
    clinicSlug,
    preview,
    widgetAccessToken,
    visitorId,
    conversationId,
    publicSessionToken,
  })

  const {
    parentOriginRef,
    requestFreshWidgetToken,
    handleSessionExpired,
  } = useWidgetParentHandoff({
    shouldSkipParentHandoff,
    clinicId,
    clinicSlug,
    preview,
    embedded,
    sessionHandoff,
    conversationId,
    publicSessionToken,
    widgetAccessToken,
    isPublicWidget,
    applyWidgetConfig,
    setConversationId,
    setLeadId,
    setPublicSessionToken,
    setSessionHydrated,
    setVisitorId,
    setWidgetAccessToken,
  })

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400)
    }
  }, [isOpen])

  useEffect(() => {
    if (conversationId) return
    const timer = window.setTimeout(() => {
      setMessages((prev) => {
        if (prev.length !== 1 || prev[0]?.id !== 'welcome') return prev
        return [
          {
            id: 'welcome',
            role: 'bot',
            content: widgetConfig.welcomeMessage || DEFAULT_WELCOME_MESSAGE,
            timestamp: getCurrentTime(),
            showQuickActions: true,
          },
        ]
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [conversationId, widgetConfig.welcomeMessage])

  useWidgetPreviewConfig({
    preview,
    clinicId,
    clinicSlug,
    setWidgetConfig,
  })

  const { sendMessage } = useWidgetChat({
    clinicId,
    clinicSlug,
    preview,
    isDemoMode,
    isPublicWidget,
    conversationId,
    leadId,
    publicSessionToken,
    visitorId,
    widgetAccessToken,
    sessionHydrated,
    setInputValue,
    setMessages,
    setIsTyping,
    setWidgetConfig,
    setConversationId,
    setLeadId,
    setPublicSessionToken,
    setWidgetAccessToken,
    handleSessionExpired,
    requestFreshWidgetToken,
    logWidgetEvent,
    getDemoResponse,
  })

  const {
    openWidgetActionLink,
    handleQuickAction,
    handleFormSubmit,
    handleCloseWidget,
  } = useWidgetActions({
    widgetConfig,
    clinicSlug,
    widgetAccessToken,
    visitorId,
    conversationId,
    publicSessionToken,
    leadId,
    embedded,
    parentOriginRef,
    setIsOpen,
    setShowAppointmentForm,
    setMessages,
    sendMessage,
    logWidgetEvent,
    requestFreshWidgetToken,
  })

  return (
    <WidgetView
      embedded={embedded}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      primaryColor={primaryColor}
      widgetConfig={widgetConfig}
      showLeadGate={showLeadGate}
      leadGateCopy={leadGateCopy}
      isTyping={isTyping}
      messages={messages}
      inputValue={inputValue}
      setInputValue={setInputValue}
      sessionHydrated={sessionHydrated}
      showAppointmentForm={showAppointmentForm}
      handleCloseWidget={handleCloseWidget}
      handleQuickAction={handleQuickAction}
      openWidgetActionLink={openWidgetActionLink}
      handleFormSubmit={handleFormSubmit}
      sendMessage={sendMessage}
      chatEndRef={chatEndRef}
      inputRef={inputRef}
    />
  )
}
