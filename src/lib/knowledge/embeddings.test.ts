import { describe, expect, it } from 'vitest'
import { serializePgVector } from '@/lib/knowledge/embeddings'

describe('knowledge embeddings helpers', () => {
  it('serializes vectors for pgvector RPC input', () => {
    expect(serializePgVector([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]')
  })

  it('rounds to 8 decimal places', () => {
    expect(serializePgVector([0.123456789])).toBe('[0.12345679]')
  })
})
