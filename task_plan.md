# Task Plan: Replace Freemius Billing With Lemon Squeezy

## Goal
Move this SaaS from Freemius billing to Lemon Squeezy, remove Freemius code, and prove the permanent path across UI, API, database, feature gates, webhooks, secrets, tests, and rollback.

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements, Docs, and Code Discovery
- [x] Capture user constraints and AGENTS.md rules
- [x] Load planning, security, and coding standards skills
- [x] Search memory for prior workspace billing traces
- [x] Scan live repo for Freemius/payment references
- [x] Fetch official Lemon Squeezy, Next.js, React, Supabase, and security docs
- **Status:** complete

### Phase 2: Full Billing Dependency Trace
- [x] Read every Freemius billing file, caller, API route, component, type, migration, and env helper
- [x] Read shared auth, clinic access, Supabase admin, rate limit, feature-gate, and widget/chat callers
- [x] Build function-to-function dependency map
- [x] Prove the current root issues with file and line references
- **Status:** complete

### Phase 3: Options and Selected Architecture
- [x] Compare 3-4 migration options
- [x] Select the most secure, scalable, MVP-appropriate permanent option
- [x] Explain rejected options and system-wide impact
- [x] Complete scenario matrix and hidden-risk review
- **Status:** complete

### Phase 4: Implementation
- [x] State exact files/functions/tables/routes to change and not touch before edits
- [x] Replace Freemius SDK/API routes/server logic with Lemon Squeezy equivalents
- [x] Remove Freemius dependency/config/code and update UI wording/routes
- [x] Add structured error logs in payment functions
- [x] Add or update focused unit/integration tests
- **Status:** complete

### Phase 5: Verification and Delivery
- [x] Run typecheck/lint/targeted tests
- [x] Verify no Freemius references remain except migration history or explicit docs
- [x] Check large files and large functions with split recommendations
- [ ] Provide rollout, rollback, manual tests, and monitoring notes
- **Status:** in_progress

## Key Questions
1. Which current Freemius tables and columns are the source of truth for billing and feature gates?
2. Which UI surfaces call billing status or checkout, and do they refresh automatically after payment changes?
3. Which server routes/webhooks use service-role access, and do they prove clinic/user ownership safely?
4. Does Lemon Squeezy checkout/webhook data map cleanly to current clinic-owned billing rows?
5. Is a schema rename/replacement needed, or can compatibility be kept without leaving Freemius code?
6. What needs to be idempotent so duplicate webhooks or double-clicked checkout cannot corrupt billing state?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Treat this as a payment-provider migration, not a string rename | Current Freemius code owns checkout, return handling, webhook sync, DB status, feature gates, widget gating, and chat gating |
| Revalidate official docs before selecting the architecture | Payment provider, Next route-handler, React UI state, and Supabase security patterns change over time |
| Do not edit product code until the dependency map and selected plan are proven | The user explicitly requires root cause, impact, and scenario analysis before code changes |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `session-catchup.py` returned no visible report output | 1 | Continued with a fresh local investigation and replaced stale planning notes |
| `find src app supabase ...` included missing top-level `app` path | 1 | Kept valid `src` and `supabase` results; future scans should use existing paths only |

## Notes
- Current live scan found `@freemius/sdk`, `src/freemius.ts`, `src/lib/freemius.ts`, `src/lib/billing/freemius-server.ts`, Freemius API routes, `BillingPage`, `WidgetInstallPage`, chat route, widget config route, and Freemius billing migration.
- Large-file review is required. Files over 500 lines include `knowledge-base-page.tsx`, `widget-install-page.tsx`, `clinic-profile-page.tsx`, `src/app/api/chat/route.ts`, `src/lib/billing/freemius-server.ts`, and others.
- Implemented Lemon Squeezy routes under `src/app/api/billing/lemonsqueezy/*`.
- The old historical Freemius migration remains for migration history/data preservation, but active source/package references were removed.
- `npm run typecheck` passed after regenerating Next route types with `npx next typegen`.
- `npm run test:run` passed with 8 files and 82 tests.
- Focused lint on changed billing files passed. Full lint still has unrelated pre-existing errors in `.vercel-tmp`, `e2e/fixtures/auth.fixture.ts`, `src/components/dashboard-page.tsx`, and `src/components/profile-page.tsx`.

## Deployment Task: 2026-06-09 Vercel Production Deploy

## Deploy Goal
Deploy the current dirty worktree to Vercel production and verify that `https://dentaflow.chat` serves the new production build.

## Deployment Phases
### Deploy Phase 1: Context and Safety Checks
- [x] Confirm Vercel project linkage
- [x] Confirm current dirty worktree without reverting user changes
- [x] Review changed-file surface enough to identify deploy blockers
- **Status:** complete

### Deploy Phase 2: Pre-Deploy Verification
- [x] Run install/build-related checks using the repo scripts
- [x] Check whether pending Supabase migrations or env blockers affect the deployed code
- **Status:** complete

### Deploy Phase 3: Production Deploy
- [x] Run Vercel production deploy
- [x] Confirm deployment is aliased to `dentaflow.chat`
- **Status:** complete

### Deploy Phase 4: Live Verification
- [x] Request `https://dentaflow.chat`
- [x] Check important public/auth/billing paths without creating real users or payments
- [x] Log any production-only warnings or blockers
- **Status:** complete

## Deploy Scope
- I am deploying the current repository state as-is.
- I am NOT reverting user changes.
- I am NOT changing product code unless a hard deploy blocker is proven.
- I am NOT creating real Supabase auth users, Lemon Squeezy products, or live payments.
- I am NOT changing hosted environment variables unless the deploy proves they are missing and the fix is required for production to boot.

## Deploy Result
- Production deployment: `dpl_xQw4uUVxfgoeZzQ88SDVpnnxGxsi`
- Deployment URL: `https://workspace-79721d51-2e5e-4efc-ba28-2f4c0d52600a-2xgr5lzqf.vercel.app`
- Domain alias: `https://dentaflow.chat`
- Vercel status: Ready
- Live verification passed for `/`, `/login`, `/signup`, protected billing status, missing widget config params, and no recent 500 logs.
- Remaining known blocker: `LEMONSQUEEZY_DEFAULT_VARIANT_ID` is not set in production, so deploy is live but Lemon Squeezy checkout is not end-to-end ready until a real product variant exists.
