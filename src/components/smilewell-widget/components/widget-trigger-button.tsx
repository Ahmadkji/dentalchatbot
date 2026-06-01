'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

interface WidgetTriggerButtonProps {
  embedded: boolean
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  primaryColor: string
}

export function WidgetTriggerButton({
  embedded,
  isOpen,
  setIsOpen,
  primaryColor,
}: WidgetTriggerButtonProps) {
  if (embedded) return null

  return (
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
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
            <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
