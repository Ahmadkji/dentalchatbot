'use client'

import { motion } from 'framer-motion'
import { Calendar, MapPin, MessageCircle, Phone, Smile, User } from 'lucide-react'
import { AppointmentForm } from '@/components/smilewell-widget/components/appointment-form'
import { BotIcon } from '@/components/smilewell-widget/components/bot-icon'
import type { ChatMessage, WidgetQuickPrompt } from '@/components/smilewell-widget/types'
import { normalizeQuickPromptIntent } from '@/components/smilewell-widget/utils/intent'
import { renderWidgetContent } from '@/components/smilewell-widget/utils/render-content'

interface WidgetMessageRowProps {
  msg: ChatMessage
  primaryColor: string
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
}

export function WidgetMessageRow({
  msg,
  primaryColor,
  quickPrompts,
  showAppointmentForm,
  handleQuickAction,
  handleFormSubmit,
  sendMessage,
}: WidgetMessageRowProps) {
  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className="flex-shrink-0 mt-1">
        {msg.role === 'bot' ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: primaryColor }}>
            <BotIcon size={16} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: primaryColor }}>
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
          {renderWidgetContent(msg.content)}
        </div>
        {msg.showQuickActions && (
          <div className="flex flex-wrap gap-2 mt-3">
            {quickPrompts.map((prompt, index) => (
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
        {msg.showForm && showAppointmentForm && <AppointmentForm onSubmit={handleFormSubmit} primaryColor={primaryColor} />}
        {msg.followupSuggestions && msg.followupSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {msg.followupSuggestions.map((suggestion, index) => (
              <motion.button
                key={`followup-${msg.id}-${index}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => void sendMessage(suggestion)}
                className="px-3 py-2 rounded-full border text-sm text-gray-600 bg-white hover:bg-gray-50 shadow-sm transition-colors"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        )}
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
  )
}
