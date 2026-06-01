import { useCallback } from 'react'
import { logWidgetFrameError } from '@/components/smilewell-widget/utils/log-widget-frame'

interface WidgetAnalyticsInput {
  clinicId: string | null
  clinicSlug: string | null
  preview: boolean
  widgetAccessToken: string | null
  visitorId: string | null
  conversationId: string | null
  publicSessionToken: string | null
}

export function useWidgetAnalytics(input: WidgetAnalyticsInput) {
  const {
    clinicId,
    clinicSlug,
    preview,
    widgetAccessToken,
    visitorId,
    conversationId,
    publicSessionToken,
  } = input

  const logWidgetEvent = useCallback(
    async (eventType: string, metadata?: Record<string, unknown>) => {
      if (!clinicSlug || !widgetAccessToken || preview) return

      try {
        await fetch('/api/analytics/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'widget',
            eventType,
            clinicSlug,
            widgetAccessToken,
            visitorId,
            conversationId: conversationId || undefined,
            publicSessionToken: publicSessionToken || undefined,
            metadata: metadata || undefined,
          }),
        })
      } catch (error) {
        logWidgetFrameError('Widget analytics event failed to send.', error, {
          clinicId,
          clinicSlug,
          eventType,
        })
      }
    },
    [clinicId, clinicSlug, conversationId, preview, publicSessionToken, visitorId, widgetAccessToken],
  )

  return { logWidgetEvent }
}
