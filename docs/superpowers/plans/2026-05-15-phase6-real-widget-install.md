# Phase 6 Real Widget Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real embeddable clinic widget that only loads approved public clinic data and only writes chat/events/appointment records to the correct clinic.

**Architecture:** Keep the current iframe widget architecture, keep the existing chat/events/appointment routes, and add one new public bootstrap route that verifies the parent website domain before minting a short-lived widget access token. Reuse the existing conversation session token flow instead of adding a new session table or rewriting the widget backend.

**Tech Stack:** Next.js App Router, React client components, Supabase Route/Admin clients, Supabase Postgres + RLS, Node `crypto`, Upstash Redis ratelimits

---

### Task 1: Lock the current root cause and scope

**Files:**
- Review: `public/widget.js`
- Review: `src/app/api/widget-settings/route.ts`
- Review: `src/components/widget-install-page.tsx`
- Review: `src/components/smilewell-widget.tsx`
- Review: `src/app/api/chat/route.ts`
- Review: `src/app/api/analytics/events/route.ts`
- Review: `src/app/api/appointment-requests/route.ts`
- Review: `src/middleware.ts`
- Review: `supabase/migrations/003_dental_clinic_onboarding.sql`
- Review: `supabase/migrations/004_clinic_profile_real_data.sql`
- Review: `supabase/migrations/011_chat_persistence.sql`

- [ ] Confirm and document the current public path:
  dashboard route generates embed code with `data-clinic-id`, script injects `/widget-frame?clinicId=...`, iframe calls `/api/chat`, `/api/analytics/events`, and `/api/appointment-requests`.
- [ ] Confirm and document the root causes:
  public tenant identity is based on `clinicId`, there is no public config bootstrap route, `allowed_domains` exists but is not enforced on public chat/event/appointment writes, and global middleware currently sets `X-Frame-Options: DENY` plus `frame-ancestors 'none'`.
- [ ] Confirm and document the existing reusable pieces:
  slug-based clinic lookup already exists in `src/app/api/chat/route.ts`, conversation public session tokens already exist in `src/lib/chat/session.ts` and `src/lib/chat/public-widget-session.ts`, and `interaction_events` already exists for widget analytics.

### Task 2: Add the smallest public bootstrap route

**Files:**
- Create: `src/app/api/widget/config/route.ts`
- Create: `src/lib/widget/widget-access-token.ts`
- Modify: `src/lib/clinics/validation.ts`

- [ ] Build `GET /api/widget/config?slug=...` as the only cross-origin browser route for the parent clinic website.
- [ ] Validate:
  slug format, browser `Origin`, clinic `status = active`, `is_live = true`, `widget_enabled = true`, and exact match against normalized `allowed_domains`.
- [ ] Return only safe public data:
  clinic name/slug/city/timezone, widget title/welcome/primary color/button toggles, public action links, active quick prompts, and a short-lived signed widget access token.
- [ ] Keep it simple:
  do not return `clinic_id`, `owner_id`, internal prompts, chunk ids, source ids, staff data, or private notes.
- [ ] Normalize domains to exact HTTPS origins only.
  No wildcard support, no regex domain rules, no path-based allowlists.

### Task 3: Switch public embed identity from clinic id to clinic slug

**Files:**
- Modify: `public/widget.js`
- Modify: `src/app/api/widget-settings/route.ts`
- Modify: `src/components/widget-install-page.tsx`

- [ ] Change generated embed code from `data-clinic-id` to `data-clinic-slug`.
- [ ] Change `public/widget.js` to:
  read `data-clinic-slug`, call `/api/widget/config?slug=...`, store a per-slug visitor id, then inject `/widget-frame?clinicSlug=...&widgetAccessToken=...&handoff=1`.
- [ ] Keep one simple backward-compatibility behavior for old installs:
  if only `data-clinic-id` is present, do not try to keep the old public flow alive; instead show an unavailable/setup warning and tell the clinic to refresh the embed code.
- [ ] Keep the internal authenticated dashboard preview simple:
  preview can still use the existing internal clinic-id preview path because it is not the public install path.

### Task 4: Make the iframe route embeddable without weakening the whole app

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/app/widget-frame/page.tsx`
- Modify: `src/components/widget-frame-page.tsx`

- [ ] Exempt `/widget-frame` from the global `X-Frame-Options: DENY` and `frame-ancestors 'none'` behavior.
- [ ] Do not remove those protections for the rest of the app.
- [ ] Pass `clinicSlug` and `widgetAccessToken` through the widget frame page to the widget component.
- [ ] Keep this simple:
  allow the iframe route to load, but enforce real access in the bootstrap token and API validation. Do not add dynamic per-clinic CSP generation unless abuse proves we need it later.

### Task 5: Reuse the existing chat route instead of building a second chat stack

**Files:**
- Modify: `src/components/smilewell-widget.tsx`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/chat/widget-api-schemas.ts`

- [ ] Public widget requests should send:
  `clinicSlug`, `visitorId`, `conversationId`, `publicSessionToken`, `widgetAccessToken`, and `message`.
- [ ] Validate the widget access token before any public write or LLM call.
- [ ] Resolve the real clinic server-side by slug only.
- [ ] Keep the existing public conversation session token flow for conversation continuity.
- [ ] Tighten public widget limits without changing admin flows:
  1000-char max message for widget path only, last 10 messages sent to the LLM for widget path only, reject empty messages, and apply ratelimit before saving the message and before calling the LLM.
- [ ] Reuse the existing `conversations`, `conversation_messages`, `message_citations`, and `unanswered_questions` flow.
  Do not add a new widget chat table.

### Task 6: Reuse the existing events route and table

**Files:**
- Modify: `src/app/api/analytics/events/route.ts`
- Modify: `src/lib/chat/widget-api-schemas.ts`

- [ ] Keep `/api/analytics/events` instead of creating a new public `/api/widget/events` route.
- [ ] Public widget events should validate `clinicSlug` plus `widgetAccessToken`.
- [ ] Keep using `interaction_events`.
  Store extra request context like `origin` and `userAgent` inside `metadata` instead of adding multiple new columns now.
- [ ] Add the public event names the product actually needs first:
  `widget_loaded`, `widget_opened`, `widget_closed`, `quick_prompt_clicked`, `message_sent`, `answer_received`, `whatsapp_clicked`, `call_clicked`, `maps_clicked`, `appointment_request`.
- [ ] Skip extra analytics categories until they become useful for the dashboard.

### Task 7: Reuse the existing appointment request route

**Files:**
- Modify: `src/app/api/appointment-requests/route.ts`

- [ ] Public widget appointment requests should use `clinicSlug` plus `widgetAccessToken` instead of `clinicId`.
- [ ] Keep the existing conversation public session token validation when `conversationId` is present.
- [ ] Do not add a dedicated widget appointment endpoint.
  The current route already owns this data and only needs a safer public clinic resolution path.

### Task 8: Add focused widget ratelimiting only where it matters

**Files:**
- Modify: `package.json`
- Create: `src/lib/widget/widget-rate-limit.ts`
- Modify: `src/app/api/widget/config/route.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/analytics/events/route.ts`
- Modify: `src/app/api/appointment-requests/route.ts`

- [ ] Add Upstash Redis ratelimiting for public widget paths only.
- [ ] Keep the existing global in-memory API limit as a coarse fallback for the rest of the app.
- [ ] Use simple first-pass limits:
  config by IP, chat by visitor id plus IP, events by visitor id, appointment request by visitor id plus IP.
- [ ] Do not add per-plan daily quota tables yet.
  If needed later, usage caps can be handled in dashboard billing logic instead of Phase 6.

### Task 9: Add the missing dashboard controls without building a heavy setup UI

**Files:**
- Modify: `src/components/widget-install-page.tsx`
- Modify: `src/app/api/widget-settings/route.ts`

- [ ] Add editable `allowedDomains` support to the dashboard settings route and page.
- [ ] Use the simplest UI that works:
  a domains table or multiline textarea with one domain origin per row, normalized to exact `https://host` origin.
- [ ] Show:
  allowed domains, slug-based install script, copy button, lightweight test guidance, and note about required CSP entries.
- [ ] Skip “last loaded at” and “install verified at” database fields for now.
  They are nice-to-have, not required to make Phase 6 safe and working.

### Task 10: Keep the database changes minimal

**Files:**
- Modify: `supabase/migrations/<new_migration>.sql`

- [ ] Only add schema changes that unblock real product behavior.
- [ ] Likely minimal migration set:
  broaden `interaction_events.event_type` allowed values for real widget analytics and optionally add a light index if query shape proves it.
- [ ] Do not add:
  `chat_events` table, `last_loaded_at`, `install_verified_at`, direct `clinic_id` on `conversation_messages`, or confidence/fallback columns unless a specific dashboard query truly needs them.

### Task 11: Test the real public flow on an external page

**Files:**
- Modify or create: targeted route tests for widget public flows
- Test manually on: a plain external HTML file outside the Next app

- [ ] Manual test:
  external page loads script, script fetches config, iframe appears, chat works, appointment request works, and events write correctly.
- [ ] Route tests:
  invalid slug, disabled widget, disallowed domain, expired widget access token, wrong conversation token, rate limit before LLM, and no private fields in config response.
- [ ] Regression checks:
  dashboard preview still works, authenticated dashboard chat still works, existing appointment request inbox still works, and authenticated widget settings page still loads.

### Task 12: Rollout and cleanup

**Files:**
- Modify: release notes or internal docs if needed

- [ ] Add env vars for widget access token signing and Upstash Redis.
- [ ] Deploy to staging or preview.
- [ ] Verify the public widget from a non-app domain before production.
- [ ] Remove any temporary legacy warnings only after clinics have refreshed old embeds.

## Decision Notes

- Keep:
  iframe architecture, existing conversation token system, existing chat route, existing events route, existing appointment route, existing Supabase tables.
- Add:
  one public bootstrap route, one signed widget access token helper, focused widget ratelimits, slug-based public identity, and domain editing in the dashboard.
- Reject:
  new `chat_events` table, new widget-only chat backend, dynamic per-clinic CSP generation, wildcard domains, public `clinicId` embed identity, and “plan for huge scale” quota systems.

## Why this is the selected approach

This plan is the smallest change set that actually fixes the real security gap. The key simplification is that only the bootstrap config request is cross-origin. After that, the iframe runs on our domain and can keep using same-origin API calls, so we do not need broad CORS logic across every widget API route. That lets us keep most of the current system and only add one new proof mechanism: a short-lived widget access token tied to the verified parent website origin.

## Testing Commands

- `npm run lint`
- `npm run test:run -- src/app/api/chat/route.test.ts`
- Add targeted tests for `src/app/api/widget/config/route.ts`
- Add targeted tests for public widget branches in `src/app/api/analytics/events/route.ts`
- Add targeted tests for public widget branches in `src/app/api/appointment-requests/route.ts`

## Rollout Checklist

- [ ] Bootstrap config route verified from an allowed external origin
- [ ] Disallowed domain rejected
- [ ] Public widget no longer depends on `clinicId`
- [ ] Widget iframe embeddable while rest of app stays non-embeddable
- [ ] Chat, events, and appointment requests validate both widget access token and conversation public session token where needed
- [ ] Public widget ratelimits run before LLM use
- [ ] No private clinic data exposed in bootstrap response
