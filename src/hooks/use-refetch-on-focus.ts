'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Re-invokes a callback when the browser window regains focus.
 *
 * This replicates SWR's `revalidateOnFocus` and TanStack Query's
 * `refetchOnWindowFocus` without adding a dependency.
 *
 * @param callback — the async function to call (e.g. loadDashboard)
 * @param enabled — set false to skip (useful when a sheet/modal is open)
 *
 * Why not `router.refresh()`?
 *   `router.refresh()` only re-renders Server Components.
 *   Our pages are client components that fetch from API routes, so
 *   we need to re-trigger the client-side fetch manually.
 *
 * Why not a shared Context?
 *   The ClinicContext docs explicitly say:
 *     "Settings, services, and customisations remain page-local
 *      because they are only consumed within their own pages."
 *   Conversation data follows the same principle.
 */
export function useRefetchOnFocus(
  callback: () => Promise<void>,
  enabled = true,
) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const handleVisibility = useCallback(() => {
    if (!enabled) return
    if (document.visibilityState === 'visible') {
      callbackRef.current().catch((error) => {
        console.error('[useRefetchOnFocus] Error during focus re-fetch', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
  }, [enabled])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [handleVisibility])
}
