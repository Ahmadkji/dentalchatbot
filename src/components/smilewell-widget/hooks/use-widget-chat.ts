import { useRef, type Dispatch, type SetStateAction } from 'react'
import type { ChatMessage, WidgetPublicConfig } from '@/components/smilewell-widget/types'
import {
  addUserWidgetMessage,
  appendBotWidgetMessage,
  appendConnectionLostMessage,
  appendGenericWidgetError,
  appendMissingClinicContextMessage,
  appendSessionExpiredMessage,
} from '@/components/smilewell-widget/hooks/use-widget-chat-messages'
import { getSourcePage } from '@/components/smilewell-widget/utils/time'
import { isAccessTokenStale } from '@/components/smilewell-widget/utils/token'

interface SendMessageOptions {
  leadCaptureSubmission?: {
    name?: string
    phone?: string
    email?: string
    inquiry: string
  }
}

interface WidgetChatInput {
  clinicId: string | null
  clinicSlug: string | null
  preview: boolean
  isDemoMode: boolean
  isPublicWidget: boolean
  conversationId: string | null
  leadId: string | null
  publicSessionToken: string | null
  visitorId: string | null
  widgetAccessToken: string | null
  sessionHydrated: boolean
  setInputValue: (value: string) => void
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  setIsTyping: (value: boolean) => void
  setWidgetConfig: Dispatch<SetStateAction<WidgetPublicConfig>>
  setConversationId: (value: string | null) => void
  setLeadId: (value: string | null) => void
  setPublicSessionToken: (value: string | null) => void
  setWidgetAccessToken: (value: string | null) => void
  handleSessionExpired: () => void
  requestFreshWidgetToken: () => Promise<string | null>
  logWidgetEvent: (eventType: string, metadata?: Record<string, unknown>) => Promise<void>
  getDemoResponse: (message: string) => string
}

export function useWidgetChat(input: WidgetChatInput) {
  const {
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
  } = input

  const isSendingRef = useRef(false)

  const sendMessage = async (text: string, options?: SendMessageOptions) => {
    const isLeadCaptureSubmission = Boolean(options?.leadCaptureSubmission)
    const isPreChatLeadGateSubmission = isLeadCaptureSubmission && !conversationId
    const messageText = (options?.leadCaptureSubmission?.inquiry || text).trim()
    if (!messageText && !isLeadCaptureSubmission) return false
    if (!sessionHydrated) return false
    if (isSendingRef.current) return false
    isSendingRef.current = true

    if (!isLeadCaptureSubmission) {
      addUserWidgetMessage(setMessages, messageText)
      setInputValue('')
    }
    setIsTyping(true)
    if (!isLeadCaptureSubmission) {
      void logWidgetEvent('message_sent', { textLength: messageText.length })
    }

    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800))
        const demoReply = getDemoResponse(messageText)
        appendBotWidgetMessage(setMessages, demoReply)
        return true
      }

      let activeAccessToken = widgetAccessToken
      if (isPublicWidget && isAccessTokenStale(widgetAccessToken)) {
        const refreshed = await requestFreshWidgetToken()
        if (refreshed) activeAccessToken = refreshed
      }

      const buildChatBody = (token: string | null) =>
        JSON.stringify({
          message: isLeadCaptureSubmission ? undefined : messageText,
          clinicId,
          clinicSlug,
          widgetAccessToken: token,
          visitorId,
          preview,
          conversationId: conversationId || undefined,
          publicSessionToken: publicSessionToken || undefined,
          sourcePage: getSourcePage() || undefined,
          leadId: leadId || undefined,
          leadCaptureSubmission: options?.leadCaptureSubmission
            ? {
                name: options.leadCaptureSubmission.name || undefined,
                phone: options.leadCaptureSubmission.phone || undefined,
                email: options.leadCaptureSubmission.email || undefined,
                inquiry: options.leadCaptureSubmission.inquiry,
              }
            : undefined,
        })

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildChatBody(activeAccessToken),
      })
      const data = await res.json()

      if (typeof data.leadGateRequired === 'boolean') {
        setWidgetConfig((prev) => ({
          ...prev,
          leadGateRequired: data.leadGateRequired,
          leadGate: data.leadGate ?? prev.leadGate,
        }))
      }

      if (typeof data.leadId === 'string') {
        setLeadId(data.leadId)
      }

      if (res.status === 401) {
        const errorCode = data.errorCode as string | undefined

        if (errorCode === 'WIDGET_TOKEN_MISSING' || errorCode === 'WIDGET_TOKEN_EXPIRED') {
          const refreshed = await requestFreshWidgetToken()

          if (refreshed) {
            const retryRes = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: buildChatBody(refreshed),
            })
            const retryData = await retryRes.json()
            if (typeof retryData.leadGateRequired === 'boolean') {
              setWidgetConfig((prev) => ({
                ...prev,
                leadGateRequired: retryData.leadGateRequired,
                leadGate: retryData.leadGate ?? prev.leadGate,
              }))
            }
            if (retryRes.ok) {
              if (retryData.conversationId) setConversationId(retryData.conversationId)
              if (typeof retryData.leadId === 'string') setLeadId(retryData.leadId)
              if (retryData.publicSessionToken) setPublicSessionToken(retryData.publicSessionToken)
              if (retryData.refreshedWidgetAccessToken) setWidgetAccessToken(retryData.refreshedWidgetAccessToken)
              void logWidgetEvent('answer_received', { retried: true })
              const retryReply =
                retryData.response || retryData.reply || retryData.answer || "I'm sorry, I couldn't process that."
              appendBotWidgetMessage(setMessages, retryReply, {
                replace: isPreChatLeadGateSubmission,
              })
              return true
            }
          }

          appendConnectionLostMessage(setMessages)
          return false
        }

        if (errorCode === 'UNAUTHENTICATED') {
          appendMissingClinicContextMessage(setMessages)
          return false
        }

        handleSessionExpired()
        appendSessionExpiredMessage(setMessages)
        return false
      }

      if (!res.ok) {
        const backendError =
          typeof data?.debug === 'string'
            ? data.debug
            : typeof data?.error === 'string'
              ? data.error
              : null

        appendGenericWidgetError(setMessages, preview, backendError)
        return false
      }

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }
      if (typeof data.leadId === 'string') {
        setLeadId(data.leadId)
      }
      if (data.publicSessionToken) {
        setPublicSessionToken(data.publicSessionToken)
      }
      if (data.refreshedWidgetAccessToken) {
        setWidgetAccessToken(data.refreshedWidgetAccessToken)
      }
      void logWidgetEvent('answer_received', { retried: false })
      const replyContent = data.response || data.reply || data.answer || "I'm sorry, I couldn't process that."
      appendBotWidgetMessage(setMessages, replyContent, {
        replace: isPreChatLeadGateSubmission,
        followupSuggestions: Array.isArray(data.followupSuggestions) ? data.followupSuggestions : undefined,
      })
      return true
    } catch {
      appendGenericWidgetError(setMessages, false, null)
      return false
    } finally {
      setIsTyping(false)
      isSendingRef.current = false
    }
  }

  return { sendMessage }
}
