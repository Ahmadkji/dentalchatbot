'use client'

import { Sparkles, Smile, X } from 'lucide-react'
import { BotIcon } from '@/components/smilewell-widget/components/bot-icon'

interface WidgetHeaderProps {
  primaryColor: string
  title: string
  onClose: () => void
}

export function WidgetHeader({ primaryColor, title, onClose }: WidgetHeaderProps) {
  return (
    <div className="relative px-5 pt-5 pb-4 flex items-center gap-3 flex-shrink-0" style={{ backgroundColor: primaryColor }}>
      <Sparkles className="absolute top-3 right-16 w-4 h-4 text-yellow-200/60" />
      <Sparkles className="absolute bottom-8 left-8 w-3 h-3 text-yellow-200/40" />
      <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md flex-shrink-0" style={{ backgroundColor: primaryColor }}>
        <BotIcon size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-white font-bold text-lg leading-tight">{title}</h1>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <p className="text-white/80 text-xs flex items-center gap-1">
            Online now <Smile className="w-3 h-3 inline" />
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        aria-label="Close chat"
      >
        <X className="w-5 h-5 text-white" />
      </button>
    </div>
  )
}
