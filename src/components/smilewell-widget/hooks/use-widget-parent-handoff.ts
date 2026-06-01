import { useEffect, useRef } from 'react'
import { useWidgetParentSession } from '@/components/smilewell-widget/hooks/use-widget-parent-session'
import type { WidgetPublicConfig } from '@/components/smilewell-widget/types'
import { logWidgetFrame, logWidgetFrameError } from '@/components/smilewell-widget/utils/log-widget-frame'

interface ParentHandoffInput {
  shouldSkipParentHandoff: boolean
  clinicId: string | null
  clinicSlug: string | null
  preview: boolean
  embedded: boolean
  sessionHandoff: boolean
  conversationId: string | null
  publicSessionToken: string | null
  widgetAccessToken: string | null
  isPublicWidget: boolean
  applyWidgetConfig: (nextConfig?: WidgetPublicConfig | null) => void
  setConversationId: (value: string | null) => void
  setLeadId: (value: string | null) => void
  setPublicSessionToken: (value: string | null) => void
  setSessionHydrated: (value: boolean) => void
  setVisitorId: (value: string | null) => void
  setWidgetAccessToken: (value: string | null) => void
}

export function useWidgetParentHandoff(input: ParentHandoffInput) {
  const {
    shouldSkipParentHandoff,
    clinicId,
    clinicSlug,
    preview,
    embedded,
    sessionHandoff,
    conversationId,
    publicSessionToken,
    widgetAccessToken,
    isPublicWidget,
    applyWidgetConfig,
    setConversationId,
    setLeadId,
    setPublicSessionToken,
    setSessionHydrated,
    setVisitorId,
    setWidgetAccessToken,
  } = input

  const parentOriginRef = useRef<string | null>(null)
  const { requestFreshWidgetToken, handleSessionExpired } = useWidgetParentSession({
    clinicId,
    clinicSlug,
    preview,
    parentOriginRef,
    setConversationId,
    setLeadId,
    setPublicSessionToken,
  })

  useEffect(() => {
    if (shouldSkipParentHandoff) {
      return
    }

    logWidgetFrame('info', 'Widget iframe starting parent handoff.', {
      clinicId,
      clinicSlug,
      preview,
      embedded,
      sessionHandoff,
    })

    parentOriginRef.current = null
    let timeoutId: ReturnType<typeof setTimeout>

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      if (!event.data || typeof event.data.type !== 'string') return

      if (!parentOriginRef.current) {
        parentOriginRef.current = event.origin
        logWidgetFrame('info', 'Widget iframe locked parent origin.', {
          clinicId,
          clinicSlug,
          parentOrigin: event.origin,
        })
      }

      if (event.origin !== parentOriginRef.current) {
        logWidgetFrameError(
          'Widget iframe rejected a message because the parent origin changed.',
          new Error('Parent origin mismatch'),
          {
            clinicId,
            clinicSlug,
            receivedOrigin: event.origin,
            expectedOrigin: parentOriginRef.current,
            messageType: event.data.type,
          },
        )
        return
      }

      if (event.data.type === 'clinic_widget:hydrate') {
        const payload = event.data.payload
        if (payload?.conversationId && payload?.publicSessionToken) {
          setConversationId(payload.conversationId)
          setPublicSessionToken(payload.publicSessionToken)
        }
        if (payload?.visitorId) {
          setVisitorId(payload.visitorId)
        }
        if (payload?.widgetAccessToken) {
          setWidgetAccessToken(payload.widgetAccessToken)
        }
        if (payload?.widgetConfig) {
          applyWidgetConfig(payload.widgetConfig)
        }
        setSessionHydrated(true)
        logWidgetFrame('info', 'Widget iframe hydrated from parent.', {
          clinicId,
          clinicSlug,
          hasConversationId: Boolean(payload?.conversationId),
          hasPublicSessionToken: Boolean(payload?.publicSessionToken),
          hasWidgetAccessToken: Boolean(payload?.widgetAccessToken),
        })
        clearTimeout(timeoutId)
        return
      }

      if (event.data.type === 'clinic_widget:clear_session') {
        setConversationId(null)
        setLeadId(null)
        setPublicSessionToken(null)
        setSessionHydrated(true)
        logWidgetFrame('info', 'Widget iframe cleared the session at parent request.', {
          clinicId,
          clinicSlug,
        })
        clearTimeout(timeoutId)
        return
      }

      if (event.data.type === 'clinic_widget:token_refresh') {
        const newToken = event.data.payload?.widgetAccessToken
        if (newToken) {
          setWidgetAccessToken(newToken)
          logWidgetFrame('info', 'Widget iframe received a refreshed access token.', {
            clinicId,
            clinicSlug,
          })
        } else {
          logWidgetFrameError(
            'Widget iframe received a token refresh message without a token.',
            new Error('Missing widgetAccessToken'),
            {
              clinicId,
              clinicSlug,
            },
          )
        }
        if (event.data.payload?.widgetConfig) {
          applyWidgetConfig(event.data.payload.widgetConfig)
        }
        return
      }

      if (event.data.type.indexOf('clinic_widget:') === 0) {
        logWidgetFrame('warn', 'Widget iframe received an unexpected parent message type.', {
          clinicId,
          clinicSlug,
          messageType: event.data.type,
        })
      }
    }

    window.addEventListener('message', handleMessage)
    window.parent.postMessage({ type: 'clinic_widget:ready', payload: { clinicId } }, '*')
    logWidgetFrame('info', 'Widget iframe sent ready handshake.', {
      clinicId,
      clinicSlug,
    })

    timeoutId = setTimeout(() => {
      logWidgetFrame('warn', 'Widget iframe did not receive a parent response within the handshake timeout.', {
        clinicId,
        clinicSlug,
      })
      setSessionHydrated(true)
    }, 2000)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('message', handleMessage)
    }
  }, [
    shouldSkipParentHandoff,
    clinicId,
    clinicSlug,
    preview,
    embedded,
    sessionHandoff,
    applyWidgetConfig,
    setConversationId,
    setLeadId,
    setPublicSessionToken,
    setSessionHydrated,
    setVisitorId,
    setWidgetAccessToken,
  ])

  useEffect(() => {
    if ((!clinicId && !clinicSlug) || preview) return
    if (!conversationId || !publicSessionToken) return

    const targetOrigin = parentOriginRef.current ?? '*'
    window.parent.postMessage(
      {
        type: 'clinic_widget:state_updated',
        payload: {
          conversationId,
          publicSessionToken,
          clinicId,
          clinicSlug,
          updatedAt: new Date().toISOString(),
        },
      },
      targetOrigin,
    )
  }, [conversationId, publicSessionToken, clinicId, clinicSlug, preview])

  useEffect(() => {
    if (!widgetAccessToken || !isPublicWidget) return
    if (typeof window === 'undefined' || window.parent === window) return
    if (!parentOriginRef.current) return

    window.parent.postMessage(
      { type: 'clinic_widget:access_token_refreshed', payload: { widgetAccessToken } },
      parentOriginRef.current,
    )
  }, [widgetAccessToken, isPublicWidget])

  return {
    parentOriginRef,
    requestFreshWidgetToken,
    handleSessionExpired,
  }
}
