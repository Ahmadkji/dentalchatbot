'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { LeadCaptureForm, type LeadCaptureFormValues } from '@/components/lead-capture-form'
import type { ChatMessage, WidgetLeadGatePayload, WidgetQuickPrompt } from '@/components/smilewell-widget/types'
import { WidgetMessageRow } from '@/components/smilewell-widget/components/widget-message-row'
import { WidgetTypingIndicator } from '@/components/smilewell-widget/components/widget-typing-indicator'
import type { RefObject } from 'react'

interface WidgetChatPanelProps {
  showLeadGate: boolean
  leadGateCopy: WidgetLeadGatePayload
  isTyping: boolean
  primaryColor: string
  messages: ChatMessage[]
  quickPrompts: WidgetQuickPrompt[]
  showAppointmentForm: boolean
  handleQuickAction: (prompt: { label: string; intent?: string | null }) => void
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
}

export function WidgetChatPanel({
  showLeadGate,
  leadGateCopy,
  isTyping,
  primaryColor,
  messages,
  quickPrompts,
  showAppointmentForm,
  handleQuickAction,
  handleFormSubmit,
  sendMessage,
  chatEndRef,
}: WidgetChatPanelProps) {
  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
    >
      {showLeadGate ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1 min-h-0"
        >
          <LeadCaptureForm
            fields={leadGateCopy.fields}
            initialValues={leadGateCopy.prefill}
            title="Start the conversation"
            description={leadGateCopy.prompt}
            submitLabel="Start chat"
            canDismiss={false}
            submitting={isTyping}
            primaryColor={primaryColor}
            onDismiss={() => {}}
            onSubmit={async (values: LeadCaptureFormValues) => {
              await sendMessage('', {
                leadCaptureSubmission: {
                  name: values.name,
                  phone: values.phone || undefined,
                  email: values.email || undefined,
                  inquiry: '',
                },
              })
            }}
          />
        </motion.div>
      ) : (
        <AnimatePresence>
          {messages.map((msg) => (
            <WidgetMessageRow
              key={msg.id}
              msg={msg}
              primaryColor={primaryColor}
              quickPrompts={quickPrompts}
              showAppointmentForm={showAppointmentForm}
              handleQuickAction={handleQuickAction}
              handleFormSubmit={handleFormSubmit}
              sendMessage={sendMessage}
            />
          ))}
        </AnimatePresence>
      )}

      {isTyping && <WidgetTypingIndicator primaryColor={primaryColor} />}
      <div ref={chatEndRef} />
    </div>
  )
}
