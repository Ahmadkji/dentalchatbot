'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Shared clinic state for cross-component communication.
 *
 * The DashboardShell is the natural provider — it wraps every dashboard page.
 * Any page that mutates clinic data calls refreshClinic() to synchronise
 * the sidebar name, initials, and other shell-level display values.
 *
 * Design decisions:
 *  - We intentionally keep this minimal (only clinic identity data) so it
 *    stays lightweight. Settings, services, and customisations remain
 *    page-local because they are only consumed within their own pages.
 *  - We use a version counter so that any subscriber can detect when
 *    clinic data changed without deep-comparing the object.
 */

export interface SharedClinicProfile {
  id: string
  name: string
  address: string
  city: string
  country: string
  primaryPhone: string
  isActive: boolean
}

interface ClinicContextValue {
  /** Current clinic profile for the shell / cross-page consumers. */
  clinic: SharedClinicProfile | null
  /** Incremented every time clinic data is re-fetched from the server. */
  version: number
  /** Loading state for the initial fetch. */
  loading: boolean
  /**
   * Re-fetches the clinic profile from /api/clinic and updates the shared
   * state so the sidebar and any other subscriber re-render.
   * Returns the refreshed profile or null on failure.
   */
  refreshClinic: () => Promise<SharedClinicProfile | null>
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<SharedClinicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  const refreshClinic = useCallback(async (): Promise<SharedClinicProfile | null> => {
    try {
      const res = await fetch('/api/clinic')
      if (!res.ok) {
        console.error('[ClinicContext:refreshClinic] API returned non-OK', {
          status: res.status,
          statusText: res.statusText,
        })
        return null
      }
      const data = await res.json()
      const profile: SharedClinicProfile = {
        id: data.id ?? '',
        name: data.name ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        country: data.country ?? '',
        primaryPhone: data.primaryPhone ?? data.phone ?? '',
        isActive: data.isActive === true, // strict boolean — default false if missing
      }
      setClinic(profile)
      setVersion((v) => v + 1)
      return profile
    } catch (error) {
      console.error('[ClinicContext:refreshClinic] Failed to refresh clinic', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const profile = await refreshClinic()
      if (!cancelled) {
        // If refreshClinic returned null we still stop loading — the shell
        // shows skeleton until a re-fetch succeeds.
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [refreshClinic])

  return (
    <ClinicContext.Provider value={{ clinic, version, loading, refreshClinic }}>
      {children}
    </ClinicContext.Provider>
  )
}

/**
 * Hook to access the shared clinic context.
 * Must be used inside a <ClinicProvider>.
 */
export function useClinicContext(): ClinicContextValue {
  const ctx = useContext(ClinicContext)
  if (!ctx) {
    throw new Error('useClinicContext must be used inside a <ClinicProvider>')
  }
  return ctx
}
