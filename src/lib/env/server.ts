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
  FREEMIUS_PRODUCT_ID: z.string().min(1).optional(),
  FREEMIUS_API_KEY: z.string().min(1).optional(),
  FREEMIUS_SECRET_KEY: z.string().min(1).optional(),
  FREEMIUS_PUBLIC_KEY: z.string().min(1).optional(),
  FREEMIUS_DEFAULT_PLAN_ID: z.string().min(1).optional(),
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
  FREEMIUS_PRODUCT_ID: process.env.FREEMIUS_PRODUCT_ID,
  FREEMIUS_API_KEY: process.env.FREEMIUS_API_KEY,
  FREEMIUS_SECRET_KEY: process.env.FREEMIUS_SECRET_KEY,
  FREEMIUS_PUBLIC_KEY: process.env.FREEMIUS_PUBLIC_KEY,
  FREEMIUS_DEFAULT_PLAN_ID: process.env.FREEMIUS_DEFAULT_PLAN_ID,
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
  FREEMIUS_PRODUCT_ID: '',
  FREEMIUS_API_KEY: '',
  FREEMIUS_SECRET_KEY: '',
  FREEMIUS_PUBLIC_KEY: '',
  FREEMIUS_DEFAULT_PLAN_ID: undefined as string | undefined,
};

export const serverEnv = {
  ...publicEnv,
  ...(serverResult.success ? serverResult.data : serverDefaults),
};
