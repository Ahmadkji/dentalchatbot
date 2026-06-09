# Findings & Decisions

## Requirements
- Replace Freemius with Lemon Squeezy as the payment provider.
- Remove Freemius code, not just hide it.
- Read the full related billing code path before proposing or editing.
- Verify the selected approach with official docs only.
- Compare 3-4 professional options, reject weaker options, and select one permanent solution.
- Add error logging in payment functions.
- Verify UI/backend/database connections, local state, unnecessary network calls, server/client boundaries, and one source of truth.
- Find files over 500 lines and recommend splits without changing behavior.

## Initial Live Repo Findings
- `package.json` currently depends on `@freemius/sdk`.
- Freemius server logic exists in `src/lib/billing/freemius-server.ts`.
- Additional Freemius helper files exist at `src/freemius.ts` and `src/lib/freemius.ts`.
- Freemius API routes exist at:
  - `src/app/api/billing/freemius/checkout/route.ts`
  - `src/app/api/billing/freemius/status/route.ts`
  - `src/app/api/billing/freemius/return/route.ts`
  - `src/app/api/billing/freemius/webhook/route.ts`
- Frontend billing UI exists at `src/components/billing-page.tsx` and is loaded by `src/app/dashboard/billing/page.tsx`.
- `src/components/widget-install-page.tsx` references `/api/billing/freemius/status` based on the initial scan.
- Feature gating reaches beyond the billing page:
  - `src/app/api/chat/route.ts` imports `getClinicFreemiusBillingStatus`.
  - `src/app/api/widget/config/route.ts` imports `getClinicFreemiusBillingStatus`.
  - `src/lib/billing/feature-gates.ts` computes feature permissions.
- Database migration `supabase/migrations/20260525120000_clinic_freemius_billing.sql` created the Freemius billing tables/policies/indexes.
- Existing TypeScript output files (`tsc_out.txt`, `tsc_final.txt`, `tsc_final2.txt`) show unresolved Freemius route type errors, so the current payment code is already not type-clean.
- `src/components/billing-page.tsx` fetches `/api/billing/freemius/status` once on mount, opens checkout in a new browser tab, and only shows a query-param toast after return. It does not refetch after the return toast or tab focus.
- The repo already has `src/hooks/use-refetch-on-focus.ts`, used by dashboard pages to refresh client-fetched data after browser focus. The hook comments state that `router.refresh()` only re-renders Server Components and does not refetch page-local client API state.
- `src/app/api/widget/config/route.ts` and `src/app/api/chat/route.ts` are the non-billing callers that depend on payment state. They only need stable feature booleans, not provider details.
- `src/lib/clinic-access.ts` proves the checkout route is correctly scoped to active owner/admin clinic members before checkout creation.
- `supabase/migrations/003_dental_clinic_onboarding.sql` already provides `public.is_clinic_member()` and `public.has_clinic_role()` helpers for RLS policies. New billing tables should reuse those patterns.
- `src/lib/rate-limit.ts` provides distributed DB-backed rate limit helpers, but no billing checkout-specific key exists yet.

## Large Files Over 500 Lines
- `src/components/knowledge-base-page.tsx` - 1164 lines.
- `src/components/widget-install-page.tsx` - 939 lines.
- `src/components/clinic-profile-page.tsx` - 903 lines.
- `src/lib/knowledge/sources.ts` - 872 lines.
- `src/app/api/chat/route.ts` - 831 lines.
- `src/lib/knowledge/jobs.ts` - 812 lines.
- `src/components/ui/sidebar.tsx` - 783 lines.
- `src/components/services-pricing-page.tsx` - 680 lines.
- `src/lib/clinic-imports.ts` - 661 lines.
- `src/components/dashboard-page.tsx` - 646 lines.
- `supabase/migrations/008_feature4_real_knowledge_sources.sql` - 638 lines.
- `src/components/appointment-requests-page.tsx` - 623 lines.
- `src/lib/billing/freemius-server.ts` - 601 lines.
- `supabase/migrations/20260516031211_mvp_production_schema_contracts.sql` - 595 lines.
- `supabase/migrations/003_dental_clinic_onboarding.sql` - 582 lines.
- `src/lib/knowledge-import.ts` - 563 lines.
- `src/components/faq-page.tsx` - 552 lines.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Do a schema/API/UI dependency trace before editing | Billing state gates widget config, chat behavior, billing UI, and checkout |
| Official docs will drive the selected Lemon Squeezy pattern | User required current secure/scalable/latest verification |
| Treat duplicate checkout and duplicate webhook delivery as first-class risks | Payment providers commonly retry webhooks and users can double-submit |

## Official Documentation Findings
- Lemon Squeezy API requests use HTTPS, JSON:API headers, and Bearer API-key auth; keys must stay private and out of code/client bundles.
- Lemon Squeezy checkouts can be created on demand through `POST /v1/checkouts`, can prefill email/name, can include `checkout_data.custom`, and return a unique checkout URL.
- Lemon Squeezy custom checkout data is returned later as `meta.custom_data` in Order, Subscription, and License key webhook events, so clinic/user/attempt IDs can be carried without showing them to the customer.
- Lemon Squeezy webhooks send `POST` requests with `X-Event-Name` and `X-Signature`; non-200 responses are retried up to three more times with exponential backoff.
- Lemon Squeezy says to verify `X-Signature` by computing an HMAC SHA-256 hash from the raw request body and webhook signing secret, then compare with a timing-safe comparison.
- Lemon Squeezy recommends storing webhook events locally, even temporarily, then returning 200 quickly and processing safely.
- Lemon Squeezy subscription docs say customers should retain app access for subscription statuses except expired.
- Lemon Squeezy test mode supports checkout flow, subscriptions, webhooks, API integrations, and separate test-mode API keys.
- Next.js route handlers support standard Web `Request` and `Response`, `POST` handlers, raw `request.text()` for webhooks, and no Pages Router body-parser config is needed.
- Next.js Server Components should keep API keys/secrets on the server; Client Components are for state, event handlers, effects, and browser APIs.
- Next.js fetch docs and caching guide confirm `cache: 'no-store'` for fresh server fetches, router refresh for client route cache refresh, and revalidation APIs for cached data.
- React docs confirm duplicated local state does not coordinate across components; shared state should have one owner and be lifted or refreshed from one source of truth.
- Supabase RLS docs require RLS on exposed public tables, `auth.uid()` policies, indexes on policy columns, and keeping service role keys server-only because they bypass RLS.
- OWASP REST and Secrets cheat sheets support API method allowlists, 429 for rate limiting, keeping API keys out of URLs/client code, and central secret management/rotation.

## Root Cause Notes
- The current product is not provider-neutral. Freemius naming exists in env validation, package dependency, server helper, API paths, UI copy, data-table name, DB columns, and chat/widget imports.
- The Freemius server helper does too much in one file: provider client, env validation, status mapping, checkout attempt storage, redirect sync, webhook sync, and DB mapping all live in `src/lib/billing/freemius-server.ts`.
- The existing return route trusts a Freemius-specific signed redirect. Lemon Squeezy docs make webhooks the correct durable local sync mechanism; a Lemon redirect URL should be a UI hint only, not the source of truth.
- The existing checkout duplicate protection can race because it checks active attempts before creating the external checkout. Lemon checkout sessions should model `pending`, `checkout_created`, `processed`, `expired`, and `failed` states.

## Implementation Findings
- Added `supabase/migrations/20260607120000_lemon_squeezy_billing.sql` with:
  - `clinic_billing_subscriptions` as the provider-backed entitlement source of truth.
  - `clinic_billing_checkout_sessions` for duplicate-safe checkout creation.
  - `clinic_billing_webhook_events` with `payload_sha256` uniqueness for exact retry idempotency.
  - RLS enabled, service-role writes, authenticated member/admin read policies.
- Added `src/lib/billing/lemonsqueezy-server.ts` with server-only Lemon Squeezy API calls, webhook HMAC verification, event recording, checkout session state transitions, and billing status mapping.
- Added new API routes:
  - `POST /api/billing/lemonsqueezy/checkout`
  - `GET /api/billing/lemonsqueezy/status`
  - `POST /api/billing/lemonsqueezy/webhook`
- Deleted active Freemius routes and helper files:
  - `src/app/api/billing/freemius/*`
  - `src/lib/billing/freemius-server.ts`
  - `src/lib/freemius.ts`
  - `src/freemius.ts`
- Removed `@freemius/sdk` from `package.json` and `package-lock.json`.
- Updated `src/components/billing-page.tsx` to use Lemon Squeezy, refresh on focus, refresh after checkout return, and stop treating redirect as proof of payment.
- Removed an unnecessary unused billing status request from `src/components/smilewell-widget/hooks/use-widget-preview-config.ts`.
- Updated chat and widget public config routes to call `getClinicBillingStatus` from the Lemon Squeezy billing module.

## Verification Results
- `npx next typegen` passed and regenerated current route types after deleting old `.next` Freemius validator cache.
- `npm run typecheck` passed.
- Focused billing tests passed: 2 files, 8 tests.
- Full Vitest suite passed: 8 files, 82 tests.
- Focused lint on changed billing files passed.
- Full `npm run lint` still fails on pre-existing unrelated files:
  - `.vercel-tmp/upload-env.cjs`
  - `.vercel-tmp/vercel-install.cjs`
  - `e2e/fixtures/auth.fixture.ts`
  - `src/components/dashboard-page.tsx`
  - `src/components/profile-page.tsx`

## Remaining Large-File Review
- `src/lib/billing/lemonsqueezy-server.ts` is now 997 lines. It should be split into focused files if this billing surface grows: `config.ts`, `checkout.ts`, `webhook.ts`, `status.ts`, and `types.ts`. I kept it consolidated for this MVP cutover to avoid adding more import churn after the provider replacement.
- `src/components/knowledge-base-page.tsx`, `src/components/widget-install-page.tsx`, `src/components/clinic-profile-page.tsx`, `src/app/api/chat/route.ts`, `src/lib/knowledge/sources.ts`, and `src/lib/knowledge/jobs.ts` remain over 500 lines and should be split by workflow or responsibility in separate follow-up changes.

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Initial large-file command included missing top-level `app` directory | Use `src` and `supabase` paths only |
| Search output was large and included historical `tsc_*` files | Keep those as proof of existing errors, then narrow reads to source files |

## Resources To Read Next
- Freemius billing source and all callers.
- Supabase billing migration and RLS policies.
- Auth/clinic access helpers used by billing API routes.
- Official Lemon Squeezy checkout, API auth, webhook, subscription, license/order docs.
- Official Next.js route handler/security/caching docs.
- Official React state docs for UI refresh/local state behavior.
- Official Supabase RLS docs.

## Visual/Browser Findings
- No browser or screenshot inspection yet.

---
*Update this file after every 2 view/browser/search operations*
