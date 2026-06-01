'use client'

import type { WidgetPublicConfig } from '@/components/smilewell-widget/types'

interface WidgetActionLinksProps {
  widgetConfig: WidgetPublicConfig
  onOpenLink: (kind: 'whatsapp' | 'call' | 'maps') => void
}

export function WidgetActionLinks({ widgetConfig, onOpenLink }: WidgetActionLinksProps) {
  if (!widgetConfig.showWhatsappButton && !widgetConfig.showCallButton && !widgetConfig.showLocationButton) {
    return null
  }

  return (
    <div className="border-b border-gray-100 px-4 py-3 bg-white flex gap-2 overflow-x-auto">
      {widgetConfig.showWhatsappButton && widgetConfig.whatsappLink && (
        <button
          type="button"
          onClick={() => onOpenLink('whatsapp')}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          WhatsApp
        </button>
      )}
      {widgetConfig.showCallButton && widgetConfig.phoneLink && (
        <button
          type="button"
          onClick={() => onOpenLink('call')}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Call
        </button>
      )}
      {widgetConfig.showLocationButton && widgetConfig.mapsLink && (
        <button
          type="button"
          onClick={() => onOpenLink('maps')}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Location
        </button>
      )}
    </div>
  )
}
