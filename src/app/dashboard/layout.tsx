import { redirect } from 'next/navigation'
import { createSupabaseServerComponentClient } from '@/lib/supabase/server-component'
import DashboardShell from '@/components/dashboard/shell'

/**
 * Server-side auth guard for the entire dashboard area (defense-in-depth).
 *
 * The proxy/middleware already redirects unauthenticated users, but Next.js
 * docs explicitly recommend verifying auth inside each protected boundary
 * rather than relying on middleware alone: a matcher change or a thrown error
 * in the proxy must not expose the dashboard shell.
 *
 * We use getClaims() (not getUser()) because:
 *   1. Supabase docs: "Always use supabase.auth.getClaims() to protect pages
 *      and user data." getClaims() validates the JWT signature against the
 *      project's published public keys — locally, without a network round-trip
 *      (when asymmetric signing keys are used).
 *   2. getUser() contacts the Auth server on every call (~50-200ms latency).
 *      On dashboard navigations, that delay would be user-visible.
 *   3. The proxy already refreshed the token before this layout renders, so
 *      the JWT in the cookie is fresh. We just need to verify its signature.
 *
 * API routes that need the freshest user records still use getUser() via
 * requireAuth(). This layout only needs to answer: "is there a valid session?"
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerComponentClient()

  let authenticated = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    authenticated = !error && Boolean(data?.claims?.sub)

    if (error) {
      console.warn('[dashboard:layout] getClaims check failed — treating as unauthenticated', {
        errorMessage: error.message,
        errorCode: error.status ?? null,
      })
    }
  } catch (error) {
    // Never render the dashboard shell on an unexpected auth failure.
    console.error('[dashboard:layout] unexpected error during auth check', {
      error: error instanceof Error ? error.message : String(error),
    })
    authenticated = false
  }

  if (!authenticated) {
    redirect('/login')
  }

  return <DashboardShell>{children}</DashboardShell>
}
