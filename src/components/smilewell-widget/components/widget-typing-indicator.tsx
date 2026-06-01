'use client'

import { motion } from 'framer-motion'
import { BotIcon } from '@/components/smilewell-widget/components/bot-icon'

export function WidgetTypingIndicator({ primaryColor }: { primaryColor: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0" style={{ backgroundColor: primaryColor }}>
        <BotIcon size={16} />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0 }} className="w-2 h-2 bg-gray-400 rounded-full" />
          <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 bg-gray-400 rounded-full" />
          <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 bg-gray-400 rounded-full" />
        </div>
      </div>
    </motion.div>
  )
}
