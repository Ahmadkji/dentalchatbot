import { createMessageId } from '@/lib/chat/message-id'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatMessage, WidgetPublicConfig } from '@/components/smilewell-widget/types'
import { useWidgetAppointmentRequest } from '@/components/smilewell-widget/hooks/use-widget-appointment-request'
import { normalizeQuickPromptIntent } from '@/components/smilewell-widget/utils/intent'
import { getCurrentTime } from '@/components/smilewell-widget/utils/time'

interface WidgetActionsInput {
  widgetConfig: WidgetPublicConfig
  clinicSlug: string | null
  widgetAccessToken: string | null
  visitorId: string | null
  conversationId: string | null
  publicSessionToken: string | null
  leadId: string | null
  embedded: boolean
  parentOriginRef: MutableRefObject<string | null>
  setIsOpen: (value: boolean) => void
  setShowAppointmentForm: (value: boolean) => void
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  sendMessage: (text: string) => Promise<boolean>
  logWidgetEvent: (eventType: string, metadata?: Record<string, unknown>) => Promise<void>
  requestFreshWidgetToken: () => Promise<string | null>
}

export function useWidgetActions(input: WidgetActionsInput) {
  const {
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
  } = input

  const { handleFormSubmit } = useWidgetAppointmentRequest({
    clinicSlug,
    widgetAccessToken,
    visitorId,
    conversationId,
    publicSessionToken,
    leadId,
    setShowAppointmentForm,
    setMessages,
    logWidgetEvent,
    requestFreshWidgetToken,
  })

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
      window.location.assign(finalLink)
      return
    }

    window.open(finalLink, '_blank', 'noopener,noreferrer')
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
        { id: createMessageId('widget'), role: 'user', content: prompt.label, timestamp: getCurrentTime() },
        {
          id: createMessageId('widget'),
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

  return {
    openWidgetActionLink,
    handleQuickAction,
    handleFormSubmit,
    handleCloseWidget,
  }
}
