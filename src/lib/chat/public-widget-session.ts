/**
 * Shared types and validation helpers for the public widget
 * session handoff protocol between host page and iframe.
 */

// ─── Message protocol types ────────────────────────────────

export type ParentToIframe =
  | {
      type: 'clinic_widget:hydrate'
      payload: {
        conversationId: string | null
        publicSessionToken: string | null
        clinicId: string | null
      }
    }
  | {
      type: 'clinic_widget:clear_session'
      payload: { clinicId: string | null }
    }

export type IframeToParent =
  | {
      type: 'clinic_widget:ready'
      payload: { clinicId: string | null }
    }
  | {
      type: 'clinic_widget:state_updated'
      payload: {
        conversationId: string
        publicSessionToken: string
        clinicId: string | null
        updatedAt: string
      }
    }
  | {
      type: 'clinic_widget:start_new_session'
      payload: { clinicId: string | null }
    }

// ─── Session storage model ─────────────────────────────────

export interface WidgetSession {
  conversationId: string
  publicSessionToken: string
  clinicId: string
  updatedAt: string
  version: number
}

/** Build the localStorage key for a given clinic. */
export function sessionStorageKey(clinicId: string): string {
  return `clinic_widget_session_v1_${clinicId}`
}

// ─── Server-side validation ────────────────────────────────

import 'server-only'

import { hashSessionToken } from './session'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { widgetTokenInputSchema } from './widget-api-schemas'

/** Token validity period: 30 days */
export const TOKEN_EXPIRY_DAYS = 30
export const TOKEN_EXPIRY_MS = TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

/**
 * Validate a public session token against a conversation.
 * Returns the conversation row if valid, null otherwise.
 *
 * Checks:
 * - conversationId exists
 * - token hash matches
 * - clinic matches
 * - token is not expired
 */
export async function validatePublicSessionToken(input: {
  conversationId: string
  publicSessionToken: string
  expectedClinicId: string
}): Promise<{
  id: string
  clinic_id: string
  public_token_hash: string | null
  public_token_expires_at: string | null
} | null> {
  // Early format validation: reject malformed input before hitting DB
  const parsed = widgetTokenInputSchema.safeParse(input)
  if (!parsed.success) return null

  const adminClient = createSupabaseAdminClient()
  const tokenHash = hashSessionToken(input.publicSessionToken)

  const { data: conv } = await adminClient
    .from('conversations')
    .select('id, clinic_id, public_token_hash, public_token_expires_at')
    .eq('id', input.conversationId)
    .eq('public_token_hash', tokenHash)
    .eq('clinic_id', input.expectedClinicId)
    .maybeSingle()

  if (!conv) return null

  // Check expiry
  if (conv.public_token_expires_at) {
    const expiresAt = new Date(conv.public_token_expires_at).getTime()
    if (Date.now() > expiresAt) return null
  }

  return conv
}

/**
 * Extend the token expiry for a conversation on valid activity.
 * Called after every successful public request.
 */
export async function extendTokenExpiry(conversationId: string): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

  await adminClient
    .from('conversations')
    .update({ public_token_expires_at: newExpiry })
    .eq('id', conversationId)
}

/**
 * Cookie-based token fallback with expiry enforcement.
 * Used when the explicit token path fails (e.g., third-party cookies
 * are still working but the host-page session was lost).
 *
 * Checks:
 * - cookie token hash matches
 * - clinic matches
 * - token is not expired
 */
export async function validateCookieTokenFallback(input: {
  conversationId: string
  rawToken: string
  expectedClinicId: string
}): Promise<{
  id: string
  clinic_id: string
  public_token_hash: string | null
  public_token_expires_at: string | null
} | null> {
  const adminClient = createSupabaseAdminClient()
  const tokenHash = hashSessionToken(input.rawToken)

  const { data: conv } = await adminClient
    .from('conversations')
    .select('id, clinic_id, public_token_hash, public_token_expires_at')
    .eq('id', input.conversationId)
    .eq('clinic_id', input.expectedClinicId)
    .eq('public_token_hash', tokenHash)
    .maybeSingle()

  if (!conv) return null

  // Enforce expiry — same check as explicit token path
  if (conv.public_token_expires_at) {
    const expiresAt = new Date(conv.public_token_expires_at).getTime()
    if (Date.now() > expiresAt) return null
  }

  return conv
}
