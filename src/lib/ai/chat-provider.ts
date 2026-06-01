import "server-only";

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";

export type ChatProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ContactExtractionResult = {
  name?: string;
  phone?: string;
  email?: string;
};

const contactExtractionSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

const contactExtractionJsonSchema = {
  name: "contact_fields",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: ["string", "null"],
        description: "The user's name if they explicitly shared it, otherwise null.",
      },
      phone: {
        type: ["string", "null"],
        description: "The user's phone number if they explicitly shared it, otherwise null.",
      },
      email: {
        type: ["string", "null"],
        description: "The user's email if they explicitly shared it, otherwise null.",
      },
    },
    required: ["name", "phone", "email"],
  },
} as const;

function normalizeText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEmail(value: string | null | undefined): string | undefined {
  const trimmed = normalizeText(value)?.toLowerCase();
  if (!trimmed) return undefined;
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(trimmed) ? trimmed : undefined;
}

function normalizePhone(value: string | null | undefined): string | undefined {
  const trimmed = normalizeText(value);
  if (!trimmed) return undefined;

  const parsed = parsePhoneNumberFromString(trimmed, "US");
  if (parsed?.isValid()) {
    return parsed.number;
  }

  const digitCount = trimmed.replace(/\D/g, "").length;
  return digitCount >= 7 ? trimmed : undefined;
}

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
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const errorDetail = data?.error?.message ?? "Unknown error";
      console.error('[chat-provider] OpenRouter API error', {
        status: response.status,
        model: serverEnv.OPENROUTER_MODEL,
        retryAfter,
        error: errorDetail,
      });
      throw new Error(
        `OpenRouter chat failed with ${response.status}${
          retryAfter ? ` retry-after=${retryAfter}` : ""
        }: ${errorDetail}`,
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
      console.error('[chat-provider] OpenRouter request timed out', {
        model: serverEnv.OPENROUTER_MODEL,
        timeoutMs,
      });
      throw new Error("OpenRouter chat request timed out.");
    }
    console.error('[chat-provider] Unexpected error during chat generation', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateAssistantReply(input: {
  messages: ChatProviderMessage[];
}): Promise<string> {
  return generateWithOpenRouter(input.messages);
}

export async function extractContactFields(input: {
  transcriptLines: string[];
}): Promise<ContactExtractionResult> {
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
        messages: [
          {
            role: "system",
            content:
              "You extract contact fields from a dental chat. Only use facts the user explicitly shared. Ignore assistant text. Return null for any missing field. Do not guess or infer.",
          },
          {
            role: "user",
            content: [
              "Extract the user's name, phone number, and email from this transcript.",
              "Only use the user's messages. Do not infer values.",
              "",
              ...input.transcriptLines,
            ].join("\n"),
          },
        ],
        temperature: 0,
        max_tokens: 120,
        response_format: {
          type: "json_schema",
          json_schema: contactExtractionJsonSchema,
        },
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const errorDetail = data?.error?.message ?? "Unknown error";
      console.error('[chat-provider] OpenRouter contact extraction failed', {
        status: response.status,
        model: serverEnv.OPENROUTER_MODEL,
        retryAfter,
        error: errorDetail,
      });
      return {};
    }

    const rawContent = normalizeAssistantContent(
      data?.choices?.[0]?.message?.content,
    );

    if (!rawContent) {
      return {};
    }

    const parsed = contactExtractionSchema.safeParse(JSON.parse(rawContent));
    if (!parsed.success) {
      return {};
    }

    const name = normalizeText(parsed.data.name)
    const phone = normalizePhone(parsed.data.phone)
    const email = normalizeEmail(parsed.data.email)

    return {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error('[chat-provider] OpenRouter contact extraction timed out', {
        model: serverEnv.OPENROUTER_MODEL,
        timeoutMs,
      });
    } else {
      console.error('[chat-provider] Unexpected error during contact extraction', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}
