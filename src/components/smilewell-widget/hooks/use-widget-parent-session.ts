import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import { logWidgetFrame, logWidgetFrameError } from '@/components/smilewell-widget/utils/log-widget-frame'

interface ParentSessionInput {
  clinicId: string | null
  clinicSlug: string | null
  preview: boolean
  parentOriginRef: MutableRefObject<string | null>
  setConversationId: (value: string | null) => void
  setLeadId: (value: string | null) => void
  setPublicSessionToken: (value: string | null) => void
}

export function useWidgetParentSession(input: ParentSessionInput) {
  const {
    clinicId,
    clinicSlug,
    preview,
    parentOriginRef,
    setConversationId,
    setLeadId,
    setPublicSessionToken,
  } = input

  const requestFreshWidgetToken = useCallback(async () => {
    if (!(clinicId || clinicSlug) || preview || window.parent === window) {
      logWidgetFrame('warn', 'Widget iframe skipped token refresh because parent handoff is unavailable.', {
        clinicId,
        clinicSlug,
        preview,
      })
      return null
    }

    const targetOrigin = parentOriginRef.current ?? '*'
    logWidgetFrame('info', 'Widget iframe requested a fresh access token from the parent.', {
      clinicId,
      clinicSlug,
      targetOrigin,
    })
    window.parent.postMessage(
      { type: 'clinic_widget:token_expired', payload: { clinicSlug } },
      targetOrigin,
    )

    return await new Promise<string | null>((resolve) => {
      let settled = false
      const cleanup = () => {
        window.removeEventListener('message', handler)
        clearTimeout(timer)
      }
      const finish = (value: string | null) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      }
      const handler = (event: MessageEvent) => {
        if (event.source !== window.parent) return
        if (parentOriginRef.current && event.origin !== parentOriginRef.current) return
        if (event.data?.type !== 'clinic_widget:token_refresh') return
        const refreshedToken = event.data.payload?.widgetAccessToken || null
        if (!refreshedToken) {
          logWidgetFrameError(
            'Parent replied to token refresh without a token.',
            new Error('Missing widgetAccessToken'),
            {
              clinicId,
              clinicSlug,
            },
          )
        }
        finish(refreshedToken)
      }
      const timer = setTimeout(() => {
        logWidgetFrame('warn', 'Timed out waiting for a refreshed widget token from the parent.', {
          clinicId,
          clinicSlug,
        })
        finish(null)
      }, 5000)
      window.addEventListener('message', handler)
    })
  }, [clinicId, clinicSlug, preview, parentOriginRef])

  const handleSessionExpired = useCallback(() => {
    setConversationId(null)
    setLeadId(null)
    setPublicSessionToken(null)

    if ((clinicId || clinicSlug) && !preview) {
      const targetOrigin = parentOriginRef.current ?? '*'
      window.parent.postMessage(
        { type: 'clinic_widget:start_new_session', payload: { clinicId, clinicSlug } },
        targetOrigin,
      )
    }
  }, [clinicId, clinicSlug, preview, parentOriginRef, setConversationId, setLeadId, setPublicSessionToken])

  return {
    requestFreshWidgetToken,
    handleSessionExpired,
  }
}
