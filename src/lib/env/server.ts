import "server-only";

import { z } from "zod";
import { publicEnv } from "./public";

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WIDGET_ACCESS_TOKEN_SECRET: z.string().min(32),
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  AI_DAILY_MESSAGE_LIMIT: z.number().int().positive().optional(),
  AI_RESPONSE_TIMEOUT_MS: z.number().int().positive().optional(),
});

const serverResult = ServerEnvSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  WIDGET_ACCESS_TOKEN_SECRET: process.env.WIDGET_ACCESS_TOKEN_SECRET,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  AI_DAILY_MESSAGE_LIMIT: process.env.AI_DAILY_MESSAGE_LIMIT
    ? Number(process.env.AI_DAILY_MESSAGE_LIMIT)
    : undefined,
  AI_RESPONSE_TIMEOUT_MS: process.env.AI_RESPONSE_TIMEOUT_MS
    ? Number(process.env.AI_RESPONSE_TIMEOUT_MS)
    : undefined,
});

if (!serverResult.success && process.env.NODE_ENV !== 'test') {
  throw new Error(
    `Missing required server env vars: ${serverResult.error.issues.map((i) => i.path.join('.')).join(', ')}`,
  );
}

const serverDefaults = {
  SUPABASE_SERVICE_ROLE_KEY: '',
  WIDGET_ACCESS_TOKEN_SECRET: '',
  UPSTASH_REDIS_REST_URL: undefined as string | undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined as string | undefined,
  AI_DAILY_MESSAGE_LIMIT: undefined as number | undefined,
  AI_RESPONSE_TIMEOUT_MS: undefined as number | undefined,
};

export const serverEnv = {
  ...publicEnv,
  ...(serverResult.success ? serverResult.data : serverDefaults),
};
