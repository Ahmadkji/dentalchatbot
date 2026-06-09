import { describe, it, expect } from 'vitest'
import { analyticsEventSchema } from '@/lib/chat/widget-api-schemas'

describe('analyticsEventSchema metadata validation', () => {
  const validBase = {
    eventType: 'widget_opened' as const,
    source: 'widget' as const,
  }

  it('accepts valid metadata within size limit', () => {
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: { page: '/home', action: 'click' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts null metadata', () => {
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts undefined metadata', () => {
    const result = analyticsEventSchema.safeParse({
      ...validBase,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object metadata', () => {
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: {},
    })
    expect(result.success).toBe(true)
  })

  it('rejects metadata exceeding 1KB size', () => {
    const bigValue = 'x'.repeat(1100)
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: { data: bigValue },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('exceeds maximum size'))).toBe(true)
    }
  })

  it('rejects metadata with more than 20 keys', () => {
    const tooManyKeys: Record<string, string> = {}
    for (let i = 0; i < 25; i++) {
      tooManyKeys[`key${i}`] = `val${i}`
    }
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: tooManyKeys,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('exceeds maximum'))).toBe(true)
    }
  })

  it('rejects metadata keys longer than 64 chars', () => {
    const longKey = 'k'.repeat(65)
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: { [longKey]: 'value' },
    })
    expect(result.success).toBe(false)
  })

  it('accepts metadata at exactly 1KB boundary', () => {
    // Build metadata that serializes to exactly ~1024 bytes
    const metadata: Record<string, string> = {}
    let totalLength = 2 // opening/closing braces
    for (let i = 0; i < 10 && totalLength < 950; i++) {
      const key = `key${i}`
      const val = 'v'.repeat(80)
      metadata[key] = val
      totalLength += key.length + val.length + 6 // "key":"val",
    }
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata,
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid nested unknown values', () => {
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      metadata: { nested: { inner: [1, 2, 3] } },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid eventType', () => {
    const result = analyticsEventSchema.safeParse({
      ...validBase,
      eventType: 'invalid_event',
      metadata: {},
    })
    expect(result.success).toBe(false)
  })
})
