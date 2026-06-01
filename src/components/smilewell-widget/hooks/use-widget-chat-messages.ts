import { createMessageId } from '@/lib/chat/message-id'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatMessage } from '@/components/smilewell-widget/types'
import { getCurrentTime } from '@/components/smilewell-widget/utils/time'

export function addUserWidgetMessage(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  messageText: string,
) {
  setMessages((prev) => [
    ...prev,
    {
      id: createMessageId('widget'),
      role: 'user',
      content: messageText,
      timestamp: getCurrentTime(),
    },
  ])
}

export function appendBotWidgetMessage(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  content: string,
  options?: {
    replace?: boolean
    followupSuggestions?: string[]
  },
) {
  const message: ChatMessage = {
    id: createMessageId('widget'),
    role: 'bot',
    content,
    timestamp: getCurrentTime(),
    followupSuggestions:
      options?.followupSuggestions && options.followupSuggestions.length > 0
        ? options.followupSuggestions
        : undefined,
  }

  if (options?.replace) {
    setMessages([message])
    return
  }

  setMessages((prev) => [...prev, message])
}

export function appendGenericWidgetError(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  preview: boolean,
  backendError?: string | null,
) {
  const content =
    preview && backendError
      ? `I'm sorry, something went wrong. Technical detail: ${backendError}`
      : "I'm sorry, something went wrong."
  appendBotWidgetMessage(setMessages, content)
}

export function appendSessionExpiredMessage(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  appendBotWidgetMessage(setMessages, 'Your session has expired. Please start a new conversation.')
}

export function appendMissingClinicContextMessage(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  appendBotWidgetMessage(
    setMessages,
    "I'd love to help, but I need a clinic context to connect to. If you're exploring DentalGPT Studio, try asking about features, pricing, or setup — I have answers ready!",
  )
}

export function appendConnectionLostMessage(
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  appendBotWidgetMessage(setMessages, 'Connection lost. Please try sending your message again.')
}
