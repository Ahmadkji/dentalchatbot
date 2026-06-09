import "server-only";

import { z } from "zod";
import { publicEnv } from "./public";

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WIDGET_ACCESS_TOKEN_SECRET: z.string().min(32),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default("deepseek/deepseek-v4-flash:free"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_SITE_NAME: z.string().min(1).optional(),
  AI_DAILY_MESSAGE_LIMIT: z.number().int().positive().optional(),
  AI_RESPONSE_TIMEOUT_MS: z.number().int().positive().optional(),
  LEMONSQUEEZY_API_KEY: z.string().min(1).optional(),
  LEMONSQUEEZY_STORE_ID: z.string().min(1).optional(),
  LEMONSQUEEZY_DEFAULT_VARIANT_ID: z.string().min(1).optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().min(1).optional(),
  LEMONSQUEEZY_TEST_MODE: z.enum(['true', 'false']).optional(),
});

const serverResult = ServerEnvSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  WIDGET_ACCESS_TOKEN_SECRET: process.env.WIDGET_ACCESS_TOKEN_SECRET,
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
  LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY,
  LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID,
  LEMONSQUEEZY_DEFAULT_VARIANT_ID: process.env.LEMONSQUEEZY_DEFAULT_VARIANT_ID,
  LEMONSQUEEZY_WEBHOOK_SECRET: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
  LEMONSQUEEZY_TEST_MODE: process.env.LEMONSQUEEZY_TEST_MODE,
});

if (!serverResult.success && process.env.NODE_ENV !== 'test') {
  throw new Error(
    `Missing required server env vars: ${serverResult.error.issues.map((i) => i.path.join('.')).join(', ')}`,
  );
}

const serverDefaults = {
  SUPABASE_SERVICE_ROLE_KEY: '',
  WIDGET_ACCESS_TOKEN_SECRET: '',
  OPENROUTER_API_KEY: '',
  OPENROUTER_MODEL: 'deepseek/deepseek-v4-flash:free',
  OPENROUTER_SITE_URL: undefined as string | undefined,
  OPENROUTER_SITE_NAME: undefined as string | undefined,
  AI_DAILY_MESSAGE_LIMIT: undefined as number | undefined,
  AI_RESPONSE_TIMEOUT_MS: undefined as number | undefined,
  LEMONSQUEEZY_API_KEY: '',
  LEMONSQUEEZY_STORE_ID: '',
  LEMONSQUEEZY_DEFAULT_VARIANT_ID: undefined as string | undefined,
  LEMONSQUEEZY_WEBHOOK_SECRET: '',
  LEMONSQUEEZY_TEST_MODE: 'false' as 'true' | 'false',
};

export const serverEnv = {
  ...publicEnv,
  ...(serverResult.success ? serverResult.data : serverDefaults),
};
