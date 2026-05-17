# Production Safety & Security Hardening Plan

---

# 1. Fix production build safety

## File: `next.config.ts`

Your current file ignores TypeScript build errors and disables React Strict Mode. 

**Replace the whole file with this:**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1:4010", "localhost:4010"],
  reactStrictMode: true,
};

export default nextConfig;
```

## File: `package.json`

Replace your `scripts` block with this:

```json
"scripts": {
  "dev": "next dev -p 3000 2>&1 | tee dev.log",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest",
  "test:run": "vitest run",
  "check": "bun run typecheck && bun run lint && bun run test:run",
  "build": "bun run check && next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
  "start": "NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log"
}
```

---

# 2. Fix Supabase env mismatch

Your route client expects `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, but browser/middleware use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  

## New file: `src/lib/env/public.ts`

```ts
import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export const publicEnv = PublicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
```

## New file: `src/lib/env/server.ts`

```ts
import "server-only";

import { z } from "zod";
import { publicEnv } from "./public";

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WIDGET_ACCESS_TOKEN_SECRET: z.string().min(32),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  AI_DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(500),
  AI_RESPONSE_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
});

export const serverEnv = {
  ...publicEnv,
  ...ServerEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WIDGET_ACCESS_TOKEN_SECRET: process.env.WIDGET_ACCESS_TOKEN_SECRET,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    AI_DAILY_MESSAGE_LIMIT: process.env.AI_DAILY_MESSAGE_LIMIT,
    AI_RESPONSE_TIMEOUT_MS: process.env.AI_RESPONSE_TIMEOUT_MS,
  }),
};
```

## File: `src/lib/supabase/client.ts`

Replace with:

```ts
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

## File: `src/lib/supabase/config.ts`

Replace with:

```ts
import { publicEnv } from "@/lib/env/public";

export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseAuthConfig(): SupabaseAuthConfig {
  return {
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
```

## File: `src/lib/supabase/admin.ts`

Replace with:

```ts
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/server";

export function createSupabaseAdminClient() {
  return createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
```

---

# 3. Add reusable clinic role guard

Your `/api/clinic` route already checks owner/admin before profile updates. Use the same pattern everywhere else. 

## New file: `src/lib/clinic-access.ts`

```ts
import "server-only";

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { getCurrentClinic } from "@/lib/clinics/current";
import { getCurrentClinic as loadCurrentClinic } from "@/lib/clinics/current";
import type { createSupabaseRouteClient } from "@/lib/supabase/route-client";

type SupabaseRouteClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseRouteClient>>
>;

export type ClinicRole = "owner" | "admin" | "staff";

export async function requireCurrentClinicAccess(
  supabase: SupabaseRouteClient,
  user: Pick<User, "id">,
  allowedRoles?: ClinicRole[],
): Promise<
  | {
      current: Awaited<ReturnType<typeof getCurrentClinic>>;
      error: null;
    }
  | {
      current: null;
      error: NextResponse;
    }
> {
  const current = await loadCurrentClinic(supabase, user);

  if (!current.clinic || !current.membership) {
    return {
      current: null,
      error: NextResponse.json({ error: "Onboarding required" }, { status: 409 }),
    };
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(current.membership.role as ClinicRole)
  ) {
    return {
      current: null,
      error: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 },
      ),
    };
  }

  return { current, error: null };
}
```

---

# 4. Fix `/api/widget-settings` role check + validation

Your current widget settings PATCH lets an authenticated clinic member change `allowedDomains`, which controls public widget access. 

## File: `src/app/api/widget-settings/route.ts`

Add these imports:

```ts
import { z } from "zod";
import { requireCurrentClinicAccess } from "@/lib/clinic-access";
```

Add this near the top:

```ts
const widgetSettingsPatchSchema = z
  .object({
    botName: z.string().trim().min(1).max(80).optional(),
    welcomeMessage: z.string().trim().min(1).max(500).optional(),
    primaryColor: z.string().regex(HEX_COLOR_RE).optional(),
    widgetPosition: z.enum(VALID_POSITIONS).optional(),
    allowedDomains: z.array(z.string().trim().max(255)).max(25).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required.",
  });
```

Inside `PATCH`, replace this:

```ts
const { clinic } = await getCurrentClinic(supabase, user)
if (!clinic) {
  return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
}
```

with this:

```ts
const access = await requireCurrentClinicAccess(supabase, user, ["owner", "admin"]);
if (access.error) return access.error;

const { clinic } = access.current;
```

Then replace this:

```ts
const body = await request.json()
const data: Record<string, unknown> = {}

for (const field of editableFields) {
  if (body[field] !== undefined) {
    data[field] = body[field]
  }
}
```

with this:

```ts
const body = await request.json().catch(() => null);
const parsed = widgetSettingsPatchSchema.safeParse(body);

if (!parsed.success) {
  return NextResponse.json(
    { error: parsed.error.issues[0]?.message ?? "Invalid widget settings payload." },
    { status: 400 },
  );
}

const data: Record<string, unknown> = parsed.data;
```

You can keep the rest of the update mapping.

---

# 5. Fix unauthenticated analytics write risk

Your analytics route requires token for widget events, but non-widget events can continue after `requireAuth()` fails. 

## File: `src/app/api/analytics/events/route.ts`

After this line:

```ts
const { eventType, source, conversationId, clinicId: bodyClinicId, clinicSlug, publicSessionToken, widgetAccessToken, visitorId, service, metadata } = parsed.data
```

add:

```ts
if (source !== "widget") {
  const { user, supabase, error: authError } = await requireAuth();

  if (authError) return authError;
  if (!user || !supabase) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // continue with authenticated dashboard/conversation event handling below
}