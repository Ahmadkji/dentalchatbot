# OpenRouter AI Chatbot Feature Plan

## Decision Summary

I’m assuming you want this behavior:

- keep the current chatbot flows, widget auth, knowledge search, leads, appointments, and dashboard chat exactly as they are
- replace only the AI answer generation step
- use OpenRouter on the server with model `deepseek/deepseek-v4-flash:free`
- avoid a big refactor and avoid breaking the frontend contract

That is the right MVP scope.

## What Problem This Solves

Right now your chatbot answer step is hard-wired to `z-ai-web-dev-sdk` inside `src/app/api/chat/route.ts` and the actual AI call happens in the same route. Earlier live verification notes also showed the current ZAI runtime was blocked by missing or invalid `.z-ai-config`.

The good part is: your real chatbot system is already built correctly around one backend route.

Both these UIs already call the same route:

- widget: `src/components/smilewell-widget.tsx`
- dashboard chat: `src/components/chat-page.tsx`

So we should change the AI provider only once, inside `/api/chat`, and leave the rest alone.

## Codebase Proof

Current `/api/chat` already does all the risky work before and after the LLM call:

- input validation
- widget token validation
- rate limiting
- system prompt and clinic knowledge retrieval
- conversation persistence
- lead and appointment automation
- citations and unanswered detection

That means the safest change is:

- do not touch widget request format
- do not touch response format
- do not touch Supabase tables or RLS
- do not touch session handoff
- do not touch automation logic
- only replace the AI provider call

## Solution Options

### 1. Inline swap inside `/api/chat`

- Replace `ZAI.create()` with a direct `fetch` to OpenRouter in the same file.
- Good: fastest.
- Bad: makes an already large route bigger and harder to test.
- Verdict: workable, but not the best professional choice.

### 2. Small provider helper with global env switch

- Move AI generation into one new server-only helper.
- `/api/chat` calls that helper.
- OpenRouter becomes default.
- Keep `zai` as a rollback provider for one release using one env variable.
- Good: smallest safe blast radius, clean rollback, easy tests, no frontend change.
- Bad: one extra helper file.
- Verdict: best choice.

### 3. Full per-clinic provider and model settings in DB plus dashboard UI

- Add `ai_provider` and `ai_model` to clinic settings and expose them in customizations.
- Good: more flexible later.
- Bad: more scope, more UI and API work, more test surface, not needed for this exact request.
- Verdict: overkill for this MVP change.

## Recommended Option

Choose option 2.

It is the best balance of:

- simple
- secure
- production-ready
- easy to rollback
- low risk to current widget and dashboard behavior

## Final Architecture

After the change, the flow becomes:

- user sends message from widget or dashboard
- frontend still calls `/api/chat` exactly the same way
- `/api/chat` still validates auth, widget token, session, rate limit, clinic context, and knowledge
- `/api/chat` still builds the same `llmMessages`
- instead of calling `ZAI.create()`, it calls a new server-only helper
- helper reads env config
- helper sends request to `https://openrouter.ai/api/v1/chat/completions`
- helper uses model `deepseek/deepseek-v4-flash:free`
- helper returns plain assistant text
- `/api/chat` still runs `buildSafeAssistantReply`
- `/api/chat` still saves messages, citations, unanswered questions, lead capture, and appointment requests
- frontend still receives the same JSON shape

## What Problem This Solves In Simple Words

Your chatbot already knows how to:

- verify the clinic
- load the right clinic data
- search clinic knowledge
- save the conversation
- create leads
- create appointment requests

The only weak part is the current AI engine dependency.

So this change swaps the answer engine without touching the rest of the chatbot system.

## What We Are Going To Change

Touch these files:

- modify `src/lib/env/server.ts`
- create `src/lib/ai/chat-provider.ts`
- modify `src/app/api/chat/route.ts`
- modify `src/app/api/chat/route.test.ts`
- create `src/lib/ai/chat-provider.test.ts`

Do not touch these files in phase 1:

- `src/components/smilewell-widget.tsx`
- `src/components/chat-page.tsx`
- `src/app/api/customizations/route.ts`
- Supabase migrations
- widget token and session files
- Supabase rate-limit files

That keeps scope bounded.

## Exact Env Setup

Add these server env vars:

```env
CHAT_AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=deepseek/deepseek-v4-flash:free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME=DentalGPT Studio
AI_RESPONSE_TIMEOUT_MS=20000
```

Why:

- `CHAT_AI_PROVIDER` gives you instant rollback to `zai` if OpenRouter has an outage
- `OPENROUTER_API_KEY` must stay server-side only
- `OPENROUTER_MODEL` keeps model choice configurable without code edit
- `HTTP-Referer` and `X-OpenRouter-Title` are recommended by OpenRouter
- timeout prevents hanging requests

## Exact Code For `src/lib/env/server.ts`

Replace the schema and defaults with this shape:

```ts
import "server-only";

import { z } from "zod";
import { publicEnv } from "./public";

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WIDGET_ACCESS_TOKEN_SECRET: z.string().min(32),
  CHAT_AI_PROVIDER: z.enum(["openrouter", "zai"]).default("openrouter"),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).default("deepseek/deepseek-v4-flash:free"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_SITE_NAME: z.string().min(1).optional(),
  AI_DAILY_MESSAGE_LIMIT: z.number().int().positive().optional(),
  AI_RESPONSE_TIMEOUT_MS: z.number().int().positive().optional(),
});

const serverResult = ServerEnvSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  WIDGET_ACCESS_TOKEN_SECRET: process.env.WIDGET_ACCESS_TOKEN_SECRET,
  CHAT_AI_PROVIDER: process.env.CHAT_AI_PROVIDER,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL,
  OPENROUTER_SITE_NAME: process.env.OPENROUTER_SITE_NAME,
  AI_DAILY_MESSAGE_LIMIT: process.env.AI_DAILY_MESSAGE_LIMIT
    ? Number(process.env.AI_DAILY_MESSAGE_LIMIT)
    : undefined,
  AI_RESPONSE_TIMEOUT_MS: process.env.AI_RESPONSE_TIMEOUT_MS
    ? Number(process.env.AI_RESPONSE_TIMEOUT_MS)
    : undefined,
});

if (!serverResult.success && process.env.NODE_ENV !== "test") {
  throw new Error(
    `Missing required server env vars: ${serverResult.error.issues
      .map((i) => i.path.join("."))
      .join(", ")}`,
  );
}

if (process.env.NODE_ENV !== "test") {
  const provider =
    serverResult.success
      ? serverResult.data.CHAT_AI_PROVIDER
      : process.env.CHAT_AI_PROVIDER ?? "openrouter";

  if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("OPENROUTER_API_KEY is required when CHAT_AI_PROVIDER=openrouter");
  }
}

const serverDefaults = {
  SUPABASE_SERVICE_ROLE_KEY: "",
  WIDGET_ACCESS_TOKEN_SECRET: "",
  CHAT_AI_PROVIDER: "openrouter" as const,
  OPENROUTER_API_KEY: "",
  OPENROUTER_MODEL: "deepseek/deepseek-v4-flash:free",
  OPENROUTER_SITE_URL: undefined as string | undefined,
  OPENROUTER_SITE_NAME: undefined as string | undefined,
  AI_DAILY_MESSAGE_LIMIT: undefined as number | undefined,
  AI_RESPONSE_TIMEOUT_MS: undefined as number | undefined,
};

export const serverEnv = {
  ...publicEnv,
  ...(serverResult.success ? serverResult.data : serverDefaults),
};
```

## Exact Code For New `src/lib/ai/chat-provider.ts`

Create this file:

```ts
import "server-only";

import ZAI from "z-ai-web-dev-sdk";
import { serverEnv } from "@/lib/env/server";

export type ChatProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_FAILURE_MESSAGE =
  "I apologize, I was unable to generate a response. Please try again.";

function normalizeAssistantContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function generateWithZai(messages: ChatProviderMessage[]): Promise<string> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  return answer || DEFAULT_FAILURE_MESSAGE;
}

async function generateWithOpenRouter(
  messages: ChatProviderMessage[],
): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = serverEnv.AI_RESPONSE_TIMEOUT_MS ?? 20_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    };

    if (serverEnv.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
    }

    if (serverEnv.OPENROUTER_SITE_NAME) {
      headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_SITE_NAME;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: serverEnv.OPENROUTER_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 500,
        provider: {
          allow_fallbacks: true,
          require_parameters: true,
        },
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      throw new Error(
        `OpenRouter chat failed with ${response.status}${
          retryAfter ? ` retry-after=${retryAfter}` : ""
        }: ${data?.error?.message ?? "Unknown error"}`,
      );
    }

    const answer = normalizeAssistantContent(
      data?.choices?.[0]?.message?.content,
    );

    if (!answer) {
      throw new Error("OpenRouter returned no assistant content.");
    }

    return answer;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("OpenRouter chat request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateAssistantReply(input: {
  messages: ChatProviderMessage[];
}): Promise<string> {
  if (serverEnv.CHAT_AI_PROVIDER === "zai") {
    return generateWithZai(input.messages);
  }

  return generateWithOpenRouter(input.messages);
}
```

## Exact Code Change For `src/app/api/chat/route.ts`

1. Replace the import:

```ts
import { generateAssistantReply } from "@/lib/ai/chat-provider";
```

2. Remove this import:

```ts
import ZAI from 'z-ai-web-dev-sdk'
```

3. Replace the current AI block with this:

```ts
if (runtimeCustomization.chatMode === 'human') {
  aiResponse =
    "Thanks for your message. A human team member will reply shortly. I won't auto-answer in this chat mode."
} else {
  aiResponse = await generateAssistantReply({
    messages: llmMessages,
  })
}
```

That is the key safe change.

## Why This Works

Because everything around it stays the same:

- same prompt
- same knowledge retrieval
- same auth
- same rate limiting
- same conversation save flow
- same lead creation
- same appointment creation
- same citations
- same JSON response fields

So the provider changes, but the product behavior contract stays stable.

## Exact Code Change For `src/app/api/chat/route.test.ts`

Replace the provider mock from ZAI to the new helper.

At the top:

```ts
const generateAssistantReplyMock = vi.fn()
```

Add this mock:

```ts
vi.mock('@/lib/ai/chat-provider', () => ({
  generateAssistantReply: generateAssistantReplyMock,
}))
```

Remove this old mock:

```ts
vi.mock('z-ai-web-dev-sdk', () => ({
  default: {
    create: zaiCreateMock,
  },
}))
```

In `beforeEach()` replace the old ZAI setup with:

```ts
generateAssistantReplyMock.mockResolvedValue('Test AI reply')
```

Everything else in this file can stay the same, because these tests are about auth guards, not provider behavior.

## Exact Code For New `src/lib/ai/chat-provider.test.ts`

Create this file:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const zaiCreateMock = vi.fn();

vi.mock("z-ai-web-dev-sdk", () => ({
  default: {
    create: zaiCreateMock,
  },
}));

describe("generateAssistantReply", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("uses OpenRouter by default", async () => {
    vi.stubEnv("CHAT_AI_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
    vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash:free");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        choices: [
          {
            message: {
              content: "We are open from 9 AM to 5 PM.",
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { generateAssistantReply } = await import("@/lib/ai/chat-provider");

    const reply = await generateAssistantReply({
      messages: [
        { role: "system", content: "You are a clinic bot." },
        { role: "user", content: "What are your hours?" },
      ],
    });

    expect(reply).toBe("We are open from 9 AM to 5 PM.");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-openrouter-key",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("throws a clear error when OpenRouter fails", async () => {
    vi.stubEnv("CHAT_AI_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
    vi.stubEnv("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash:free");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "12" }),
      json: async () => ({
        error: {
          message: "Rate limit exceeded",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { generateAssistantReply } = await import("@/lib/ai/chat-provider");

    await expect(
      generateAssistantReply({
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow(/OpenRouter chat failed with 429/);
  });

  it("uses ZAI when rollback provider is selected", async () => {
    vi.stubEnv("CHAT_AI_PROVIDER", "zai");

    const createCompletionMock = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "Legacy ZAI reply",
          },
        },
      ],
    });

    zaiCreateMock.mockResolvedValue({
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    });

    const { generateAssistantReply } = await import("@/lib/ai/chat-provider");

    const reply = await generateAssistantReply({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(reply).toBe("Legacy ZAI reply");
    expect(zaiCreateMock).toHaveBeenCalledTimes(1);
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
  });
});
```

## How It Actually Works After The Change

- user opens widget or dashboard chat
- frontend sends message to `/api/chat`
- `/api/chat` validates token, session, and auth like today
- `/api/chat` loads clinic profile and knowledge chunks like today
- `/api/chat` builds prompt and conversation history like today
- if `chat_mode` is `human`, same human message is returned
- if `chat_mode` is `ai`, new helper sends the prompt to OpenRouter
- OpenRouter runs `deepseek/deepseek-v4-flash:free`
- helper returns plain answer text
- route still runs safety fallback logic
- route still saves assistant message
- route still creates leads and appointments if rules match
- route still returns `answer`, `response`, `reply`, `conversationId`, `messageId`, `citations`
- widget and dashboard continue working without frontend changes

## Why This Is The Right Approach

This is the right approach because:

- it changes one boundary only
- it keeps secrets server-side
- it preserves the current frontend API contract
- it keeps rollback simple
- it avoids unnecessary database and UI work
- it is professional because provider logic is isolated and testable
- it is scalable because you can later add more providers without rewriting `/api/chat`

## How It Affects Other Functions

### Auth

- no change

### RLS and security

- no table or policy change
- OpenRouter key stays server-side
- widget token and session logic stays untouched

### Database constraints

- no migration needed
- no existing data changes

### API routes

- only `/api/chat` internals change
- request and response shape stay the same

### Frontend state

- no widget or dashboard state change required

### Loading states

- unchanged

### Error states

- frontend still sees existing generic failure behavior
- server logs become more useful because helper throws provider-specific errors

### Cron jobs

- no change

### Email sending

- no change

### Webhooks

- no change

### Tests

- route tests need mock update
- new provider unit tests should be added

### Existing users and data

- no migration
- no backfill
- no conversation schema change

### Performance

- similar to current external AI call
- timeout guards prevent stuck requests

### Mobile and responsive UI

- no UI change

### Rate limiting

- no change
- keep the current Supabase and Postgres distributed rate-limit flow exactly as it is
- do not add Redis
- do not add Upstash
- `/api/chat` should continue using the existing `consumeDistributedRateLimit()` helper backed by Supabase RPC and the `rate_limit_buckets` table

## Hidden Risks And Edge Cases

- `deepseek/deepseek-v4-flash:free` is a free model, so availability and rate limits can be less stable than paid models.
- OpenRouter can return `429` or `503`. Your current route returns generic `500` to the frontend, which is safe for compatibility but not ideal UX.
- Do not send `thinking: { type: 'disabled' }` to OpenRouter. That is ZAI-specific.
- Do not call the model page URL from the browser. Use the server route and the generic OpenRouter endpoint.
- If Vercel or local env is missing `OPENROUTER_API_KEY`, the server should fail fast instead of silently breaking at runtime.
- Some providers can return unusual content shapes. The `normalizeAssistantContent()` helper protects you from that.
- The free model may answer too confidently. Your existing `buildSafeAssistantReply()` logic must stay in place because that is your safety net.
- If OpenRouter is temporarily bad, your rollback is `CHAT_AI_PROVIDER=zai`.

## What Not To Do

- Do not put `OPENROUTER_API_KEY` in widget JS or client code.
- Do not send requests directly from `public/widget.js`.
- Do not rewrite widget auth and session code for this feature.
- Do not change response fields like `answer`, `response`, `reply`.
- Do not remove `buildSafeAssistantReply()` when switching provider.
- Do not remove `z-ai-web-dev-sdk` on day one if you want safe rollback.
- Do not add database settings or UI in phase 1 unless you really need per-clinic model control now.
- Do not change the current Supabase rate-limit implementation.

## Testing Plan

### Manual tests

- Set `CHAT_AI_PROVIDER=openrouter` and `OPENROUTER_API_KEY`.
- Start app with `npm run dev`.
- Test dashboard chat and ask clinic hours.
- Test widget via the real embed page in `tests/manual/liveproof-embed.html`.
- Ask a knowledge-backed question and confirm a real answer is returned.
- Ask an unsupported medical diagnosis question and confirm fallback or disclaimer still appears.
- Ask to book an appointment and confirm lead and appointment logic still works.

### Unit tests

- run helper tests for OpenRouter success
- run helper tests for OpenRouter error handling
- run helper tests for ZAI rollback path
- keep existing `/api/chat` auth guard tests passing

### Integration tests

- mocked `/api/chat` test with valid AI mode path
- mocked `/api/chat` test with `chat_mode=human`
- mocked `/api/chat` test where provider throws and route returns `500`

### E2E tests

- widget chat on host page
- dashboard chat conversation
- appointment request through chatbot
- session resume on existing widget conversation

### Security and RLS tests

- verify no OpenRouter key is exposed in browser network payloads
- verify widget token and session flow still rejects invalid access
- verify clinic isolation still depends on existing route logic and not provider logic

### Regression tests

- invalid `clinicSlug` still rejected
- missing widget token still rejected
- human mode still bypasses AI
- citations still save
- unanswered questions still save
- rate limit still blocks abuse through the current Supabase-backed implementation

## Exact Commands To Run

```bash
npm run test:run -- src/app/api/chat/route.test.ts src/lib/ai/chat-provider.test.ts
npm run typecheck
npm run lint
```

Then local live check:

```bash
npm run dev
```

## Official Docs To Check

- OpenRouter Quickstart
- OpenRouter Chat Completion Request
- OpenRouter Request Parameters
- OpenRouter Provider Routing
- OpenRouter Error Codes
- OpenRouter model page for `deepseek/deepseek-v4-flash:free`
- Next.js Route Handlers
- Next.js Environment Variables

## Why Other Options Were Rejected

Inline-only swap was rejected because:

- too much logic stays trapped in one large route
- harder to test
- harder to roll back cleanly

Per-clinic DB and UI settings were rejected for now because:

- more moving parts
- more API, UI, and testing surface
- not required to get OpenRouter working safely

## What Was Not Changed

- widget request shape
- widget response handling
- dashboard chat request shape
- Supabase schema
- RLS
- appointment automation
- lead automation
- knowledge search
- unanswered-question logic
- session cookies
- widget access token flow
- Supabase rate limiting

## Rollback Plan

If OpenRouter causes production trouble:

1. Change env:

```env
CHAT_AI_PROVIDER=zai
```

2. Redeploy.

That is why I recommend keeping the ZAI code path for one release instead of deleting it immediately.

## Confidence Rating

- provider integration plan: high
- low-risk scope boundary: high
- zero-frontend-change safety: high
- free-model runtime stability: medium
- existing live ZAI-break diagnosis this turn: medium

## Next Important Steps

1. Add the env variables and new helper file first.
2. Replace only the AI generation block in `/api/chat`.
3. Add the helper unit tests and update the route mocks.
4. Run tests, then do a real widget and dashboard live check.
5. Keep `zai` rollback for one release, then remove it only after OpenRouter is stable.

## Simple Final Verdict

- Is this correct? Yes.
- Is it scalable? Yes, for MVP and for future provider changes.
- Is it professional? Yes, because it keeps secrets server-side and preserves the current contracts.
- Is anything missing? Only live verification after env setup, and a temporary rollback path for safety.
