# Leads Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead manual/custom lead add surface, keep chatbot lead capture working, and harden the remaining lead APIs so they match the database contract.

**Architecture:** Keep one real lead write path for chatbot and appointment capture. Remove the unused dashboard-only add flow and the unused lead custom-field routes/UI. Add a shared lead contract helper so both lead routes return consistent data and validate input the same way. Keep the change small and reversible by avoiding any rewrite of the chat flow.

**Tech Stack:** Next.js App Router, React 19, Supabase Postgres/RLS, Zod, Vitest

---

### Task 1: Remove the dead manual Add Lead surface

**Files:**
- Modify: `src/components/leads-page.tsx`

- [ ] **Step 1: Remove the manual add dialog, form state, and submit handler**

Keep the leads table, filter tabs, detail dialog, and status update actions. Remove only the `Add Lead` dialog and the `handleAdd` flow so the page becomes read-only for manual creation.

- [ ] **Step 2: Keep chat-created leads visible**

Do not touch the `GET /api/leads` fetch path or the status update actions in this task. Those are still needed for viewing and managing leads created from chat and appointment flows.

- [ ] **Step 3: Verify the page still renders**

Run the leads dashboard page in the browser and confirm the table, search, tabs, and detail dialog still work without the add button.

### Task 2: Delete the unused lead custom-field CRUD surface

**Files:**
- Delete: `src/app/api/lead-settings/custom-fields/route.ts`
- Delete: `src/app/api/lead-settings/custom-fields/[id]/route.ts`
- Modify: `src/components/lead-collection-settings.tsx`

- [ ] **Step 1: Remove the unused fetch for custom fields**

Delete the `fetch('/api/lead-settings/custom-fields')` call from the settings loader. The response was never rendered, so keeping it only wastes a request.

- [ ] **Step 2: Remove any UI that implies custom lead fields are supported**

If a section or label mentions custom lead fields, remove it. Keep the email notification section untouched for now.

- [ ] **Step 3: Delete the dead API routes**

Remove both custom-field route files entirely. Nothing else in the repo should call them after the UI cleanup.

- [ ] **Step 4: Verify no callers remain**

Search the codebase for `lead_custom_fields` and confirm only the database migration and settings seed logic still mention it.

### Task 3: Harden the real lead CRUD contract

**Files:**
- Add: `src/lib/leads/lead-contract.ts`
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/app/api/leads/[id]/route.ts`

- [ ] **Step 1: Add a shared lead contract helper**

Create a small helper that:
- validates create and patch payloads with Zod
- maps database lead rows into one frontend-friendly shape
- keeps the response keys stable for the dashboard and leads page

- [ ] **Step 2: Update `POST /api/leads`**

Validate `name`, `phone`, `email`, `question`, `preferredContact`, `service`, `preferredDate`, `preferredTime`, `message`, `internalNote`, `status`, and `conversationId`. Keep the chatbot path working by preserving `conversationId` support.

- [ ] **Step 3: Update `GET /api/leads`**

Add a safe explicit limit and support a page or range style query so the endpoint does not depend on PostgREST’s default row cap.

- [ ] **Step 4: Update `PATCH /api/leads/:id`**

Validate only the allowed lead fields. Reject invalid status values and malformed dates instead of letting the database return a generic failure.

- [ ] **Step 5: Verify duplicate errors and tenant checks**

Keep ownership checks and rate limiting in place. Confirm duplicate-contact database errors return a friendly response instead of a generic 500.

### Task 4: Align lead settings with the real automation logic

**Files:**
- Modify: `src/components/lead-collection-settings.tsx`
- Modify: `src/lib/chat/automation.ts`
- Modify: `src/app/api/customizations/route.ts`

- [ ] **Step 1: Replace unsupported trigger choices**

Change the UI so it only offers lead trigger modes the backend actually supports.

- [ ] **Step 2: Keep lead-collection enable/disable behavior**

Leave the existing `lead_collection_enabled` flow intact so disabling lead capture still works.

- [ ] **Step 3: Keep smart follow-up fields in sync**

Make sure the settings screen and the automation helper use the same meaning for each trigger mode.

- [ ] **Step 4: Verify the chat flow still creates leads**

Confirm the chatbot still calls `POST /api/leads` and `POST /api/appointment-requests` in the same order for appointment submissions.

### Task 5: Add focused tests for the changed contracts

**Files:**
- Add/Modify: `src/lib/clinics/settings.test.ts`
- Add: `src/lib/leads/lead-contract.test.ts`
- Modify: `src/lib/chat/automation.test.ts`

- [ ] **Step 1: Add helper tests**

Cover payload validation, row mapping, and status normalization for the new lead contract helper.

- [ ] **Step 2: Add automation tests**

Cover the supported trigger modes and confirm unsupported UI values do not remain in the backend contract.

- [ ] **Step 3: Run the test suite**

Run the focused Vitest files first, then the broader typecheck/lint/test commands if the environment supports them.

- [ ] **Step 4: Verify the final diff**

Confirm no deleted custom-field route is still referenced anywhere and the chat booking flow still depends on `POST /api/leads`.
