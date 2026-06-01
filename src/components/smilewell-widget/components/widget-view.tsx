'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { WidgetActionLinks } from '@/components/smilewell-widget/components/widget-action-links'
import { WidgetChatPanel } from '@/components/smilewell-widget/components/widget-chat-panel'
import { WidgetHeader } from '@/components/smilewell-widget/components/widget-header'
import { WidgetInputBar } from '@/components/smilewell-widget/components/widget-input-bar'
import { WidgetTriggerButton } from '@/components/smilewell-widget/components/widget-trigger-button'
import type { ChatMessage, WidgetLeadGatePayload, WidgetPublicConfig } from '@/components/smilewell-widget/types'
import type { RefObject } from 'react'

interface WidgetViewProps {
  embedded: boolean
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  primaryColor: string
  widgetConfig: WidgetPublicConfig
  showLeadGate: boolean
  leadGateCopy: WidgetLeadGatePayload
  isTyping: boolean
  messages: ChatMessage[]
  inputValue: string
  setInputValue: (value: string) => void
  sessionHydrated: boolean
  showAppointmentForm: boolean
  handleCloseWidget: () => void
  handleQuickAction: (prompt: { label: string; intent?: string | null }) => void
  openWidgetActionLink: (kind: 'whatsapp' | 'call' | 'maps') => void
  handleFormSubmit: (formData: Record<string, string>) => Promise<void>
  sendMessage: (
    text: string,
    options?: {
      leadCaptureSubmission?: {
        name?: string
        phone?: string
        email?: string
        inquiry: string
      }
    },
  ) => Promise<boolean>
  chatEndRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
}

export function WidgetView({
  embedded,
  isOpen,
  setIsOpen,
  primaryColor,
  widgetConfig,
  showLeadGate,
  leadGateCopy,
  isTyping,
  messages,
  inputValue,
  setInputValue,
  sessionHydrated,
  showAppointmentForm,
  handleCloseWidget,
  handleQuickAction,
  openWidgetActionLink,
  handleFormSubmit,
  sendMessage,
  chatEndRef,
  inputRef,
}: WidgetViewProps) {
  return (
    <div className={embedded ? 'flex flex-col h-screen' : 'fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3'}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: 'bottom right' }}
            className={
              embedded
                ? 'w-full flex-1 min-h-0 bg-white flex flex-col overflow-hidden border border-gray-100'
                : 'w-[380px] h-[520px] bg-white rounded-3xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden border border-gray-100'
            }
          >
            <WidgetHeader
              primaryColor={primaryColor}
              title={widgetConfig.widgetTitle || 'Dental Assistant'}
              onClose={handleCloseWidget}
            />
            <WidgetActionLinks widgetConfig={widgetConfig} onOpenLink={openWidgetActionLink} />
            <WidgetChatPanel
              showLeadGate={showLeadGate}
              leadGateCopy={leadGateCopy}
              isTyping={isTyping}
              primaryColor={primaryColor}
              messages={messages}
              quickPrompts={widgetConfig.quickPrompts || []}
              showAppointmentForm={showAppointmentForm}
              handleQuickAction={handleQuickAction}
              handleFormSubmit={handleFormSubmit}
              sendMessage={sendMessage}
              chatEndRef={chatEndRef}
            />
            {!showLeadGate && (
              <WidgetInputBar
                inputValue={inputValue}
                setInputValue={setInputValue}
                isTyping={isTyping}
                sessionHydrated={sessionHydrated}
                primaryColor={primaryColor}
                sendMessage={sendMessage}
                inputRef={inputRef}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <WidgetTriggerButton
        embedded={embedded}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        primaryColor={primaryColor}
      />
    </div>
  )
}
