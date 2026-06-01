'use client'

import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import type { RefObject } from 'react'

interface WidgetInputBarProps {
  inputValue: string
  setInputValue: (value: string) => void
  isTyping: boolean
  sessionHydrated: boolean
  primaryColor: string
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
  inputRef: RefObject<HTMLInputElement | null>
}

export function WidgetInputBar({
  inputValue,
  setInputValue,
  isTyping,
  sessionHydrated,
  primaryColor,
  sendMessage,
  inputRef,
}: WidgetInputBarProps) {
  return (
    <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void sendMessage(inputValue)
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
  )
}
