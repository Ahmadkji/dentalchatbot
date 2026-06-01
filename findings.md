# Findings

## 2026-05-27 — Bot Setup Analysis

- Repository is currently in a heavily dirty state with many modified and untracked files, so dependency analysis must rely on present working tree (not last clean commit).
- New dashboard route structure exists under `src/app/dashboard/*` including `bot-setup` and related feature pages (faq, knowledge, services, unanswered, widget, customizations, profile, billing).
- Supabase migrations include several recent bot and knowledge changes (quick prompts, unanswered handling, lead gates, knowledge job dispatcher, service pricing contracts).
- Analysis must treat bot setup as a multi-module workflow, not a single page: API routes + shared libs + DB policies + widget/public runtime are tightly coupled.
- `src/app/dashboard/bot-setup/page.tsx` is currently a thin wrapper that renders `ClinicProfilePage`.
- `ClinicProfilePage` directly calls `/api/clinic`, `/api/settings`, and `/api/clinic/fetch-from-website`; it also PATCHes `/api/clinic` for inline and dialog edits.
- Dashboard shell (`src/components/dashboard/shell.tsx`) depends on `/api/clinic` for user/clinic identity display and `/api/auth/logout` for session termination.
- Client-side API usage scan confirms bot setup cluster routes in active use: clinic, settings, services, faq (including reorder), knowledge-sources (import/upload/refresh/detect), widget-settings (templates + quick-prompts), lead-settings, customizations, chat.
- Route wrappers under `src/app/dashboard/*` are thin and delegate to feature components; core behavior lives in `src/components/*`.
- `ClinicProfilePage` mixes three update patterns for same resource (`/api/clinic`): inline save, dialog save, and website auto-import flow.
- `FAQPage`, `ServicesPricingPage`, `KnowledgeBasePage`, and `WidgetInstallPage` all follow fetch-then-mutate patterns and reload from server after writes (no shared query cache layer).
- `KnowledgeBasePage` includes async multi-step flows (website import job polling, resumable file upload prepare/upload/finalize) and tracks background job progress via `/api/knowledge-jobs/[id]`.
- `WidgetInstallPage` has tight coupling with settings + quick prompts + templates + iframe preview refresh; changes in any API response shape can break multiple controls at once.
- `LeadCollectionSettings` and `SettingsPage` both write settings-like data but through different APIs (`/api/lead-settings` vs `/api/settings`) and different key models, implying schema/contract split.
- `/api/clinic` is a compatibility route that maps camelCase and snake_case payloads into normalized clinic updates, while rejecting `openingHours` writes in favor of `/api/clinic-hours`.
- `/api/settings`, `/api/lead-settings`, and `/api/customizations` all mutate clinic-level behavior, but each applies distinct validation and authorization boundaries, creating three parallel setting surfaces.
- Services/FAQ routes enforce owner/admin writes and rely on DB-level functions for ordering/status integrity (`swap_faq_sort_order`, profile refresh RPCs).
- Knowledge source routes are queue-driven: create/update/refresh/import/upload endpoints enqueue jobs and trigger background processing via `processQueuedKnowledgeJobs` with per-route rate limits.
- Widget stack uses two security layers: admin dashboard routes (`/api/widget-settings*`) for configuration and public routes (`/api/widget/config`, `/api/chat`, `/api/analytics/events`, `/api/appointment-requests`) requiring slug + widget access token + additional session token checks.
- Public widget chat/analytics/appointment flows support token refresh and host-page handoff; session continuity depends on both explicit `publicSessionToken` and fallback cookie validation.
