import { createMessageId } from '@/lib/chat/message-id'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatMessage } from '@/components/smilewell-widget/types'
import { getCurrentTime } from '@/components/smilewell-widget/utils/time'

interface AppointmentRequestInput {
  clinicSlug: string | null
  widgetAccessToken: string | null
  visitorId: string | null
  conversationId: string | null
  publicSessionToken: string | null
  leadId: string | null
  setShowAppointmentForm: (value: boolean) => void
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  logWidgetEvent: (eventType: string, metadata?: Record<string, unknown>) => Promise<void>
  requestFreshWidgetToken: () => Promise<string | null>
}

export function useWidgetAppointmentRequest(input: AppointmentRequestInput) {
  const {
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
  } = input

  const handleFormSubmit = async (formData: Record<string, string>) => {
    if (!formData.fullName.trim() || !formData.phone.trim()) return

    const buildBody = (token: string | null) =>
      JSON.stringify({
        clinicSlug,
        widgetAccessToken: token,
        visitorId,
        conversationId: conversationId || undefined,
        publicSessionToken: publicSessionToken || undefined,
        leadId: leadId || undefined,
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
        setShowAppointmentForm(false)
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('widget'),
            role: 'bot',
            content: `Your appointment request has been submitted. The clinic will contact you to confirm.\n\n**Name:** ${formData.fullName}\n**Phone:** ${formData.phone}\n**Date:** ${formData.date}\n**Time:** ${formData.time}`,
            timestamp: getCurrentTime(),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('widget'),
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
          id: createMessageId('widget'),
          role: 'bot',
          content: 'Sorry, something went wrong. Please try again or contact the clinic directly.',
          timestamp: getCurrentTime(),
        },
      ])
    }
  }

  return { handleFormSubmit }
}
