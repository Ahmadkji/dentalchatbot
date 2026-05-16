# Task Plan

## Goal
Add a Vitest + Playwright auth security suite, plus the minimal auth/security helpers and routes needed for the tests to pass.

## Phases
1. Infra: install test dependencies, add Vitest/Playwright config, add scripts.
2. Auth core: add redirect sanitization, origin/IP/rate-limit helpers, Supabase config/error mapping, and route client helper.
3. Auth surface: add API routes and reusable auth form components, then wire the app routes to them.
4. Tests: add unit, component, and E2E test files requested in the task.
5. Verification: run unit tests, list Playwright tests, and fix any failures.

## Notes
- Preserve existing app behavior where possible by keeping legacy routes as wrappers/aliases.
- Keep auth redirects and responses generic where the task requires anti-enumeration.
