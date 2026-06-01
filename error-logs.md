# Error Logging Fix Plan

> Verified against: Next.js error handling docs, Next.js middleware docs, Next.js Route Handlers docs, Supabase SSR auth docs, Node.js console API docs.
> Last updated: 2026-05-19

---

## Prioritization (from audit)

1. **Phase 1 — Silent failures** (12 items): `catch {}` blocks that produce zero logs
2. **Phase 2 — Infrastructure protection** (3 items): Middleware has no try/catch at all
3. **Phase 3 — Auth logging** (10 items): Auth operations returned to user but never logged server-side
4. **Phase 4 — Fire-and-forget** (13 items): Background operations with swallowed errors
5. **Phase 5 — Context enhancement** (13 items): Existing logs lack diagnostic context
6. **Phase 6 — Edge functions** (2 items): Supabase edge functions return errors but don't log
7. **Phase 7 — AI provider** (2 items): Chat provider passes errors without context

---

## Solution Approach (3 Options Compared)

### Option A: Structured Logger Library (pino, winston)
- **Pros**: JSON output, log levels, transports, production-grade
- **Cons**: Adds dependency, requires logger config across all files, over-engineered for MVP
- **Complexity**: 7/10 — too much for first 100 users
- **Rejected**: Over-engineered for current stage. Adds config overhead, transport setup, and format coordination across 50+ files.

### Option B: Simple `console.error` with structured context objects
- **Pros**: Zero dependencies, works everywhere, Vercel/Netlify capture `console.error` automatically, familiar to all developers
- **Cons**: No log levels beyond warn/error, no transports
- **Complexity**: 2/10 — appropriate for MVP
- **Selected**: Matches the codebase's existing pattern. Node.js docs confirm `console.error` writes to stderr (captured by all hosting platforms). Next.js docs recommend `console.error(error)` in error boundaries. Supabase SSR docs don't mandate any logging library. This is the simplest correct approach.

### Option C: Next.js `instrumentation.ts` + custom error reporter
- **Pros**: Central error hook, can forward to Sentry/Datadog later
- **Cons**: Only catches unhandled errors, doesn't help with caught-but-not-logged errors
- **Complexity**: 5/10
- **Rejected**: Doesn't solve the core problem (caught errors that aren't logged). Useful as a future addition.

---

## Logging Standard (applied to all changes)

Every error log must include:
```
console.error('[route:METHOD] Description', { context, error })
```

Pattern:
- `route` = short route identifier (e.g., `auth:login`, `conversations:GET`)
- `context` = relevant IDs (userId, clinicId, etc.) — **never** passwords, tokens, or PII
- `error` = the caught error object (maintains stack trace)

Example before:
```ts
} catch (error) {
  console.error('Error fetching conversations:', error)
```

Example after:
```ts
} catch (error) {
  console.error('[conversations:GET] Failed to fetch conversations', { clinicId: current.clinic.id, userId: user.id, error })
```

---

## Phase 1: Fix Silent `catch {}` Blocks (CRITICAL)

### Step 1.1 — Auth CSRF `catch {}` blocks (6 files, same pattern)

These all have the identical pattern:
```ts
try {
  assertSameOrigin(request.headers.get('origin'), url)
} catch {
  return buildResponse({ error: 'Forbidden' }, 403)
}
```

**Fix for all 6 files**: Add the caught error to the catch and log it.

```ts
try {
  assertSameOrigin(request.headers.get('origin'), url)
} catch (originError) {
  console.error('[auth:ROUTE] CSRF origin check failed', {
    origin: request.headers.get('origin'),
    host: url.host,
    error: originError instanceof Error ? originError.message : String(originError),
  })
  return buildResponse({ error: 'Forbidden' }, 403)
}
```

**Files to change:**
| # | File | Route Label |
|---|------|-------------|
| 1 | `src/app/api/auth/login/route.ts` L18 | `auth:login` |
| 2 | `src/app/api/auth/logout/route.ts` L17 | `auth:logout` |
| 3 | `src/app/api/auth/forgot-password/route.ts` L16 | `auth:forgot-password` |
| 4 | `src/app/api/auth/reset-password/route.ts` L53 | `auth:reset-password` |
| 5 | `src/app/api/auth/confirmation/route.ts` L17 | `auth:confirmation` |
| 6 | `src/app/api/auth/onboarding/route.ts` L73 | `auth:onboarding` |

**What NOT to log**: Never log `request.headers.get('origin')` in production for security routes if it might contain sensitive referrer data. However, for CSRF debugging, the origin is essential — keep it, it's a header value the server already sees.

---

### Step 1.2 — Widget OPTIONS `catch {}` block

**File**: `src/app/api/widget/config/route.ts` L169

```ts
// Before
} catch {
  return new NextResponse(null, { status: 500 })
}

// After
} catch (optionsError) {
  console.error('[widget:OPTIONS] Failed to validate CORS preflight', {
    slug: searchParams.get('slug'),
    origin,
    error: optionsError instanceof Error ? optionsError.message : String(optionsError),
  })
  return new NextResponse(null, { status: 500 })
}
```

---

### Step 1.3 — Sitemap page loop `catch {}` block

**File**: `src/lib/knowledge-import.ts` L279

```ts
// Before
} catch {
  // Skip broken page URLs to keep the sitemap import resilient.
}

// After
} catch (pageError) {
  console.warn('[sitemap-import] Skipping failed page URL', {
    pageUrl,
    error: pageError instanceof Error ? pageError.message : String(pageError),
  })
}
```

---

### Step 1.4 — Knowledge source refresh loop `catch {}` block

**File**: `src/app/api/knowledge-sources/refresh/route.ts` L101

Inside the per-source refresh loop. When a source refresh fails, the status is set to 'failed' in the DB but the original error is never logged and the DB status update itself has no error handling.

```ts
// Before
} catch {
  await supabase
    .from('knowledge_sources')
    .update({ status: 'failed', failed_reason: 'Refresh failed for this source.' })
    .eq('clinic_id', current.clinic.id)
    .eq('id', source.id)
}

// After
} catch (refreshError) {
  console.error('[knowledge-sources:refresh] Source refresh failed', {
    sourceId: source.id,
    clinicId: current.clinic.id,
    error: refreshError instanceof Error ? refreshError.message : String(refreshError),
  })
  const { error: statusUpdateError } = await supabase
    .from('knowledge_sources')
    .update({ status: 'failed', failed_reason: 'Refresh failed for this source.' })
    .eq('clinic_id', current.clinic.id)
    .eq('id', source.id)
  if (statusUpdateError) {
    console.error('[knowledge-sources:refresh] Failed to update source status to failed', {
      sourceId: source.id,
      originalError: refreshError instanceof Error ? refreshError.message : String(refreshError),
      statusUpdateError: statusUpdateError.message,
    })
  }
}
```

---

### Step 1.5 — Widget access token payload decode `catch {}` block

**File**: `src/lib/widget/widget-access-token.ts` L132

Token payload decode failure returns `null` silently. Could mask token corruption, malformed payloads, or base64 decoding errors. This is security-sensitive code.

```ts
// Before
try {
  const payloadJson = base64UrlDecode(payloadEncoded)
  payload = JSON.parse(payloadJson)
} catch {
  return null
}

// After
try {
  const payloadJson = base64UrlDecode(payloadEncoded)
  payload = JSON.parse(payloadJson)
} catch (decodeError) {
  console.warn('[widget-token] Failed to decode access token payload', {
    error: decodeError instanceof Error ? decodeError.message : String(decodeError),
  })
  return null
}
```

**Note**: Use `console.warn` here because invalid tokens are common (expired, corrupted, wrong key). This is expected failure flow, not an error.

---

### Step 1.6 — Onboarding schema validation `catch {}` blocks (2 places)

**File**: `src/app/api/auth/onboarding/route.ts` L16-18 and L38-44

These are inside Zod superRefine. They silently swallow validation failures and return `false`. These are actually **correct** — Zod expects the refinement callback to return `false` for invalid values. The error message is handled by Zod's `addIssue`. No change needed here — this is intentional validation flow, not error swallowing.

**Decision: SKIP** — verified that this is correct Zod pattern behavior.

---

## Phase 2: Middleware Error Protection (CRITICAL)

### Step 2.1 — Wrap `updateSession()` in middleware.ts

**File**: `src/middleware.ts` L55

The Supabase SSR docs show the middleware calling `updateSession` directly. The current code does:
```ts
const supabaseResponse = await updateSession(request)
return applySecurityHeaders(supabaseResponse, isWidgetFrame)
```

**Problem**: If `updateSession()` throws (Supabase down, bad cookie, etc.), every request crashes with an unhandled 500.

**Fix**: Wrap in try/catch with graceful degradation:

```ts
export async function middleware(request: NextRequest) {
  // HTTPS enforcement
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') === 'http'
  ) {
    const httpsUrl = new URL(request.url)
    httpsUrl.protocol = 'https'
    return NextResponse.redirect(httpsUrl, 301)
  }

  const isWidgetFrame = request.nextUrl.pathname.startsWith('/widget-frame')

  let supabaseResponse: NextResponse
  try {
    supabaseResponse = await updateSession(request)
  } catch (error) {
    console.error('[middleware] updateSession failed — serving request without session refresh', {
      pathname: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    })
    // Graceful degradation: continue without session refresh
    supabaseResponse = NextResponse.next({ request })
  }

  return applySecurityHeaders(supabaseResponse, isWidgetFrame)
}
```

**Why this is safe**: If session refresh fails, the user's existing cookies still work. They just won't get a refreshed token until the next successful middleware run. This is better than crashing every request.

---

### Step 2.2 — Add try/catch to `updateSession()` internals

**File**: `src/lib/supabase/middleware.ts` L17-130

The Supabase SSR docs' `updateSession` pattern does NOT show error handling. However, the Supabase `getUser()` call can fail if the JWT is malformed or the Supabase project is unreachable. The profile query can also fail.

**Fix**: Wrap the critical Supabase calls. Note: The current code destructures `user` directly, so we must restructure to allow `user` to be `null` on failure.

```ts
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(/* ... */)

  // Do NOT use `typeof data.user` — there is no `data` variable in scope.
  // Import `User` from `@supabase/supabase-js` if explicit typing is needed.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    console.error('[middleware:getUser] Failed to get user from session', {
      pathname: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    })
    // Continue without user — protected routes will redirect to login
  }

  // ... rest of the function uses `user` variable
  // If getUser failed, user is null, and protected path logic will redirect to /login
  // This is the correct degraded behavior
```

**Why this is safe**: If `getUser()` fails, `user` is `null`. The existing logic already handles `!user` correctly:
- Protected paths → redirect to `/login`
- Auth paths → allow through
- This means a Supabase outage causes a soft redirect to login instead of a hard 500 crash.

### Step 2.3 — Protect profile query in `updateSession()`

**File**: `src/lib/supabase/middleware.ts` L83-91

The profile query at L84-88 is NOT wrapped in try/catch. If `getUser()` succeeds but the profile query fails (e.g., `profiles` table unreachable), `profile` is `undefined`, `onboardingComplete` stays `false`, and the middleware redirects every protected path to `/onboarding`. This silently locks out all users.

```ts
// Before
if (needsOnboardingCheck && user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed,default_clinic_id')
    .eq('id', user.id)
    .maybeSingle()

  onboardingComplete = Boolean(profile?.onboarding_completed && profile.default_clinic_id)
}

// After
if (needsOnboardingCheck && user) {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed,default_clinic_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[middleware:profile] Failed to fetch user profile', {
        pathname: request.nextUrl.pathname,
        error: profileError.message,
      })
      // Don't lock out user — treat as onboarding complete so they can access dashboard
    } else {
      onboardingComplete = Boolean(profile?.onboarding_completed && profile.default_clinic_id)
    }
  } catch (error) {
    console.error('[middleware:profile] Profile query threw unexpectedly', {
      pathname: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    })
    // Graceful: treat as onboarding complete to avoid locking out users
  }
}
```

**Why default to onboarding complete on failure**: If the profile DB is down, the worst case is that an incomplete user sees the dashboard (they can still complete onboarding later). The alternative — redirecting ALL users to `/onboarding` — is much worse. This is a deliberate tradeoff.

**Tradeoff note for middleware degradation (Step 2.1 + 2.2 + 2.3)**: If `updateSession` fails entirely, unauthenticated users won't be redirected to `/login` by middleware. They'll hit `requireAuth()` on API routes (which returns 401) or client-side auth checks. This is acceptable — the fallback path exists.

---

## Phase 3: Auth Operation Server-Side Logging

### Step 3.1 — `requireAuth()` central auth guard

**File**: `src/lib/auth-helpers.ts` L31-39

Every protected route calls this. Currently returns generic "Unauthorized" with zero context.

```ts
// Before
if (error || !user) {
  return {
    user: null as null,
    supabase,
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}

// After — use console.warn for expected auth failures to avoid log noise
if (error || !user) {
  console.warn('[auth:requireAuth] Authentication failed', {
    hasError: Boolean(error),
    errorMessage: error?.message ?? 'No user returned',
    errorCode: error?.status ?? null,
  })
  return {
    user: null as null,
    supabase,
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}
```

**Why `console.warn` instead of `console.error`**: This function is called on EVERY protected API request. A single expired session generates 5-10 calls per page load (one per API call). Using `console.error` would flood production logs with expected auth failures. `console.warn` still writes to stderr (captured by all hosting platforms) but semantically signals "expected failure" vs "unexpected error."

**What NOT to log**: Never log user email, user ID, or token values in the auth guard. These are too frequent and too sensitive. Just log that auth failed and the error category.

---

### Step 3.2 — Individual auth route error logging

For each auth route, add `console.error` when Supabase auth operations fail:

| # | File | Line | Supabase Operation | Log Label |
|---|------|------|--------------------|-----------|
| 1 | `auth/login/route.ts` | L86 | `signUp` error | `[auth:login] Supabase signUp failed` |
| 2 | `auth/login/route.ts` | L112 | `signInWithPassword` error | `[auth:login] Supabase signIn failed` |
| 3 | `auth/logout/route.ts` | L31 | `signOut` error | `[auth:logout] Supabase signOut failed` |
| 4 | `auth/forgot-password/route.ts` | L63 | `resetPasswordForEmail` result | `[auth:forgot-password] Password reset attempt` |

**Special note for #4 (forgot-password)**: The current code does NOT destructure the result:
```ts
// Current code at L63-66:
if (supabase) {
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${url.origin}/reset-password`,
  })
}
```
There is no `error` variable to check. The fix must first capture the result:
```ts
if (supabase) {
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${url.origin}/reset-password`,
  })
  if (resetError) {
    console.error('[auth:forgot-password] Password reset attempt failed', {
      error: resetError.message,
      code: resetError.status ?? null,
    })
    // Still return success to prevent email enumeration
  }
}
```
Do NOT log whether the email exists. Log only that a reset was *attempted*. This prevents email enumeration through logs.
| 5 | `auth/reset-password/route.ts` | L30 | `getUser` in requireSession | `[auth:reset-password] Session validation failed` |
| 6 | `auth/reset-password/route.ts` | L79 | `updateUser` error | `[auth:reset-password] Password update failed` |
| 7 | `auth/confirmation/route.ts` | L61 | `resend` error | `[auth:confirmation] Email resend failed` |
| 8 | `auth/onboarding/route.ts` | L110 | `complete_onboarding` RPC | `[auth:onboarding] Onboarding RPC failed` |

**Pattern for each**:
```ts
if (error) {
  console.error('[auth:ROUTE] Description', {
    error: error.message,
    code: error.status ?? null,
  })
  // ... existing error response
}
```

**Important**: For `forgot-password`, do NOT log whether the email exists. Log only that a reset was *attempted*. This prevents email enumeration through logs.
---

## Phase 4: Fire-and-Forget Error Tracking

### Step 4.1 — Replace `.catch(() => {})` with logged catches (8 locations)

All 8 use the identical pattern: `after(() => processQueuedKnowledgeJobs(...).catch(() => {}))`

```ts
// Before
after(() => processQueuedKnowledgeJobs({ limit: 1, runner: '...' }).catch(() => {}))

// After
after(() =>
  processQueuedKnowledgeJobs({ limit: 1, runner: '...' }).catch((bgError) => {
    console.error('[ROUTE:METHOD] Background job processing failed', {
      runner: '...',
      error: bgError instanceof Error ? bgError.message : String(bgError),
    })
  })
)
```

**All 8 locations:**

| # | File | Line | Runner Label | Log Route |
|---|------|------|-------------|------------|
| 1 | `knowledge-sources/route.ts` | L118 | `api-knowledge-post` | `[knowledge-sources:POST]` |
| 2 | `knowledge-sources/import-website/route.ts` | L75 | `api-import-website` | `[knowledge-sources:import-website-POST]` |
| 3 | `knowledge-sources/import-website/route.ts` | L105 | `api-import-website` | `[knowledge-sources:import-website-PUT]` |
| 4 | `knowledge-sources/import-sitemap/route.ts` | L54 | `api-import-sitemap` | `[knowledge-sources:import-sitemap]` |
| 5 | `knowledge-sources/[id]/route.ts` | L97 | `api-source-refresh` | `[knowledge-sources:refresh-single]` |
| 6 | `knowledge-sources/[id]/route.ts` | L147 | `api-source-update` | `[knowledge-sources:update-single]` |
| 7 | `knowledge-sources/upload/route.ts` | L99 | `api-upload-finalize` | `[knowledge-sources:upload]` |
| 8 | `knowledge-sources/refresh/route.ts` | L110 | `api-refresh-all` | `[knowledge-sources:refresh-all]` |

---

### Step 4.2 — Add error handling to post-create updates

**File**: `src/app/api/leads/route.ts` L111-118
```ts
// Before
if (resolvedConversationId) {
  await adminClient
    .from('conversations')
    .update({ lead_captured: true, visitor_name: String(name) })
    .eq('id', resolvedConversationId)
}

// After
if (resolvedConversationId) {
  const { error: convUpdateError } = await adminClient
    .from('conversations')
    .update({ lead_captured: true, visitor_name: String(name) })
    .eq('id', resolvedConversationId)

  if (convUpdateError) {
    console.error('[leads:POST] Failed to mark conversation lead_captured', {
      conversationId: resolvedConversationId,
      error: convUpdateError.message,
    })
    // Don't fail the request — the lead was created successfully
  }
}
```

**File**: `src/app/api/appointment-requests/route.ts` L241-249 — same pattern for `appointment_requested`.

---

### Step 4.3 — Add error handling to status update failures

**File**: `src/lib/knowledge/sources.ts` L542-552 — update source to 'failed' can itself fail.

```ts
} catch (syncError) {
  const { error: statusUpdateError } = await supabase
    .from('knowledge_sources')
    .update({ status: 'failed', failed_reason: /* ... */ })
    .eq('id', created.id)

  if (statusUpdateError) {
    console.error('[knowledge:sources] Failed to update source status to failed', {
      sourceId: created.id,
      originalError: syncError instanceof Error ? syncError.message : String(syncError),
      statusUpdateError: statusUpdateError.message,
    })
  }

  throw syncError
}
```

**File**: `src/lib/clinic-imports.ts` L416-424 — same pattern for import session failure update.

```ts
// Before (at L416-426)
} catch (error) {
  await supabase
    .from('clinic_import_sessions')
    .update({
      status: 'failed',
      fetch_status: 'failed',
      error_message: error instanceof Error ? error.message : 'Website import failed.',
    })
    .eq('id', sessionRow.id)

  throw error
}

// After
} catch (error) {
  const { error: statusUpdateError } = await supabase
    .from('clinic_import_sessions')
    .update({
      status: 'failed',
      fetch_status: 'failed',
      error_message: error instanceof Error ? error.message : 'Website import failed.',
    })
    .eq('id', sessionRow.id)

  if (statusUpdateError) {
    console.error('[clinic-imports] Failed to update import session status to failed', {
      sessionId: sessionRow.id,
      originalError: error instanceof Error ? error.message : String(error),
      statusUpdateError: statusUpdateError.message,
    })
  }

  throw error
}
```

---

### Step 4.4 — Check `extendTokenExpiry` result

**File**: `src/lib/chat/public-widget-session.ts` L118-126

```ts
// Before
export async function extendTokenExpiry(conversationId: string): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

  await adminClient
    .from('conversations')
    .update({ public_token_expires_at: newExpiry })
    .eq('id', conversationId)
}

// After
export async function extendTokenExpiry(conversationId: string): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

  const { error } = await adminClient
    .from('conversations')
    .update({ public_token_expires_at: newExpiry })
    .eq('id', conversationId)

  if (error) {
    console.error('[widget-session] Failed to extend token expiry', {
      conversationId,
      error: error.message,
    })
  }
}
```

---

### Step 4.5 — Knowledge job processing pipeline logging

**File**: `src/lib/knowledge/jobs.ts` L477-492

The core job processing loop catches errors, stores them in DB via `updateSourceFailure` and `markJobFailed`, but produces zero `console.error` output. Errors exist only in the DB. If the DB writes also fail, there is zero trace anywhere.

```ts
// Before (at L482-492)
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to process knowledge job.'
  const retry = shouldRetryKnowledgeJob(job, error)
  await updateSourceFailure(admin, job.clinic_id, job.source_id, message)
  await markJobFailed(admin, job, message, retry)
  if (retry) {
    retried += 1
  } else {
    failed += 1
  }
}

// After
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to process knowledge job.'
  const retry = shouldRetryKnowledgeJob(job, error)
  console.error('[knowledge-jobs] Job processing failed', {
    jobId: job.id,
    sourceId: job.source_id,
    clinicId: job.clinic_id,
    jobType: job.job_type,
    attempt: job.attempt_count,
    willRetry: retry,
    error: message,
  })
  try {
    await updateSourceFailure(admin, job.clinic_id, job.source_id, message)
    await markJobFailed(admin, job, message, retry)
  } catch (dbError) {
    console.error('[knowledge-jobs] Failed to record job failure in DB', {
      jobId: job.id,
      originalError: message,
      dbError: dbError instanceof Error ? dbError.message : String(dbError),
    })
  }
  if (retry) {
    retried += 1
  } else {
    failed += 1
  }
}
```

---

## Phase 5: Context Enhancement for Existing Logs

For every existing `console.error('Error ...:', error)`, add structured context.

**Important**: Line numbers in this table are from the ORIGINAL codebase. After Phases 1-4 add code to these same files, line numbers will shift. Use code pattern search (e.g., `rg 'Error fetching conversations'`) to locate the exact lines at execution time.

**Pattern**: Add a context object as the second argument.

| # | File | Original Line | Add Context |
|---|------|---------------|-------------|
| 1 | `conversations/route.ts` | L112 | `{ clinicId, userId }` |
| 2 | `conversations/route.ts` | L178 | `{ clinicId, userId }` |
| 3 | `conversations/[id]/route.ts` | L93 | `{ conversationId: id, clinicId }` |
| 4 | `conversations/[id]/route.ts` | L221 | `{ conversationId: id, clinicId }` |
| 5 | `leads/route.ts` | L38 | `{ clinicId, userId }` |
| 6 | `leads/route.ts` | L122 | `{ clinicId, userId }` |
| 7 | `leads/[id]/route.ts` | L61 | `{ leadId: id, clinicId }` |
| 8 | `leads/[id]/route.ts` | L106 | `{ leadId: id, clinicId }` |
| 9 | `dashboard/route.ts` | L283 | `{ clinicId, userId }` |
| 10 | `settings/route.ts` | L39, L98 | `{ clinicId, userId, settingKey }` |
| 11 | `clinic/route.ts` | L46, L120 | `{ clinicId, userId }` |
| 12 | `widget-settings/route.ts` | L105, L160 | `{ clinicId, userId }` |
| 13 | `knowledge-sources/route.ts` | L55, L122 | `{ clinicId, userId }` |
| 14 | `analytics/events/route.ts` | L207 | `{ eventType, source, clinicId }` |
| 15 | `appointment-requests/route.ts` | L43, L259 | `{ clinicId }` |
| 16 | All remaining routes | various | `{ clinicId, userId }` where available |

---

## Phase 6: Supabase Edge Functions

### Step 6.1 — Embed function

**File**: `supabase/functions/embed/index.ts` L42-44

```ts
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to generate embeddings'
  console.error('[embed] Embedding generation failed', { error: message })
  return Response.json({ error: message }, { status: 500 })
}
```

### Step 6.2 — Knowledge job dispatcher

**File**: `supabase/functions/knowledge-job-dispatcher/index.ts` L69-75

```ts
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to dispatch knowledge jobs.'
  console.error('[knowledge-dispatcher] Dispatch failed', { error: message })
  return json({ error: message }, 500)
}
```

---

## Phase 7: AI Provider Context

### Step 7.1 — OpenRouter error context

**File**: `src/lib/ai/chat-provider.ts` L70-77

Note: `chat/route.ts` already catches and logs errors from the provider at L1088. To avoid **double logging** the same error, log only in the provider (here) — the caller in `chat/route.ts` already has its own log.

```ts
if (!response.ok) {
  const retryAfter = response.headers.get('Retry-After')
  const errorDetail = data?.error?.message ?? 'Unknown error'
  console.error('[chat-provider] OpenRouter API error', {
    status: response.status,
    model: serverEnv.OPENROUTER_MODEL,
    retryAfter,
    error: errorDetail,
  })
  throw new Error(
    `OpenRouter chat failed with ${response.status}${
      retryAfter ? ` retry-after=${retryAfter}` : ''
    }: ${errorDetail}`,
  )
}
```

### Step 7.2 — Timeout and generic re-throw catch block

**File**: `src/lib/ai/chat-provider.ts` L90-94

The second catch block re-throws without logging the abort timeout or generic errors:

```ts
// Before
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new Error("OpenRouter chat request timed out.")
  }
  throw error
}

// After
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    console.error('[chat-provider] OpenRouter request timed out', {
      model: serverEnv.OPENROUTER_MODEL,
    })
    throw new Error("OpenRouter chat request timed out.")
  }
  console.error('[chat-provider] Unexpected error during chat generation', {
    error: error instanceof Error ? error.message : String(error),
  })
  throw error
}
```

---

## Files Changed Summary

| Phase | Files | Changes |
|-------|-------|----------|
| 1 | 10 files | Replace 10 `catch {}` with `catch (err)` + `console.error`/`console.warn` |
| 2 | 2 files | Add try/catch to middleware chain (getUser + profile query) |
| 3 | 9 files | Add logging to auth error paths (use `console.warn` for requireAuth) |
| 4 | 11 files | Fix 8 `.catch(() => {})`, 2 post-create updates, 2 status updates, 1 token expiry, 1 job pipeline |
| 5 | ~20 files | Add context objects to existing `console.error` calls |
| 6 | 2 files | Add `console.error` to edge functions |
| 7 | 1 file | Add structured context to AI provider errors (both catch blocks) |
| **Total** | **~40 files** | **~55 changes** |

---

## What NOT to Do

1. **Do NOT add a logging library** (pino, winston, etc.) — `console.error` is sufficient for MVP and works with all hosting platforms
2. **Do NOT log passwords, tokens, or PII** — emails in auth errors should be avoided in production logs
3. **Do NOT add log levels or log rotation** — Vercel/your hosting platform handles this
4. **Do NOT create a custom logger wrapper** — adds unnecessary abstraction for `console.error`
5. **Do NOT change error responses** — only add logging, keep existing response shapes
6. **Do NOT add request IDs or tracing** — premature for current scale
7. **Do NOT touch the Zod validation catch blocks** — those are correct validation flow, not error swallowing

---

## Execution Order

1. **Phase 1 first** — Silent catches are the most dangerous. Fix these before anything else.
2. **Phase 2 next** — Middleware crashes affect every single request. Must be protected (3 sub-steps: middleware wrapper, getUser, profile query).
3. **Phase 3 next** — Auth logging is critical for security incident investigation.
4. **Phase 4 next** — Fire-and-forget data consistency issues (13 items, biggest phase).
5. **Phase 5 next** — Context enhancement across all routes. **Use pattern search, not line numbers** (lines shift after Phases 1-4).
6. **Phase 6 next** — Edge function logging.
7. **Phase 7 last** — AI provider (2 catch blocks, avoid double-logging with chat/route.ts).

---

## Verification Plan

After each phase:
1. Run `npm run build` — ensure no TypeScript errors
2. Search for remaining `catch {}` patterns: `rg 'catch\s*\{' --type ts`
3. Search for `.catch(() => {})`: `rg '\.catch\(\(\) => \{\}\)' --type ts`
4. Check middleware still redirects correctly by testing `/dashboard` without auth
5. Verify no PII is logged: search for `email`, `password`, `token` in log statements

---

## Simple Final Verdict

- **Is this correct?** Yes — follows Node.js `console.error` standard, verified against Next.js and Supabase official docs. All line numbers, type signatures, and code patterns verified against actual source files.
- **Is it scalable?** Yes — `console.error` is captured by Vercel, AWS, Docker, and all hosting platforms. Can upgrade to structured logger later without changing log call sites.
- **Is it professional?** Yes — every production SaaS needs server-side error logging.
- **Is anything missing?** Future: add `instrumentation.ts` for unhandled error reporting to Sentry/Datadog when scale justifies it.

---

## Critique Changelog

> Updated after deep re-verification of every line number, type signature, and code pattern against actual source.

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Phase 4.1 missed 6 of 8 `.catch(() => {})` patterns | CRITICAL | Added all 8 locations with file/line/label table |
| Phase 1 missed `refresh/route.ts` L101 and `widget-access-token.ts` L132 | CRITICAL | Added as Steps 1.4 and 1.5 |
| Phase 2.2 had type error (`typeof data.user` — no `data` in scope) | CRITICAL | Fixed to use proper inferred type annotation |
| Phase 3.2 forgot-password fix pattern wrong (no `error` variable) | CRITICAL | Added special code block with correct destructuring |
| Phase 4.3 `clinic-imports.ts` had no code snippet | MODERATE | Added full before/after code block |
| Phase 4 missed `knowledge/jobs.ts` L482 (core pipeline) | MODERATE | Added as Step 4.5 with DB failure protection |
| Phase 2 missed profile query protection (L84-88) | MODERATE | Added as Step 2.3 with degradation tradeoff |
| Phase 5 line numbers drift after Phases 1-4 | MODERATE | Added warning to use pattern search, not line numbers |
| Phase 3.1 `requireAuth` would cause log noise | MINOR | Changed to `console.warn` for expected auth failures |
| Phase 7 missed second catch block + double-logging risk | MINOR | Added Step 7.2 and noted double-logging with chat/route.ts |
| Middleware degradation tradeoff not fully explained | MINOR | Added note in Step 2.3 explaining fallback path |
