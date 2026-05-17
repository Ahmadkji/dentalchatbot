import { NextResponse } from 'next/server'
import { consumeDistributedRateLimit } from '@/lib/rate-limit'

export async function enforceRateLimit(input: {
  key: string
  limit: number
  windowMs: number
  failOpen?: boolean
}) {
  const result = await consumeDistributedRateLimit(
    input.key,
    input.limit,
    input.windowMs,
    1,
    input.failOpen ?? true
  )

  if (result.allowed) return null

  const response = NextResponse.json(
    { error: 'Too many requests. Please try again later.', resetAt: result.resetAt },
    { status: 429 }
  )
  response.headers.set('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))))
  return response
}
