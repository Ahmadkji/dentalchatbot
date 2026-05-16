# Findings

- This workspace does not yet have Vitest, jsdom, or Testing Library installed.
- The app currently uses `/auth` and `/dashboard`, not `/login` and `/overview`.
- The requested auth route handlers (`/api/auth/login`, `/logout`, `/forgot-password`, `/reset-password`) do not exist yet.
- There is no existing `src/lib/security.ts`, `src/lib/auth/navigation.ts`, or `src/lib/supabase/auth-errors.ts`.
