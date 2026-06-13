import { describe, expect, it } from 'vitest'
import { normalizeEmail, parseEmailList } from '@/lib/email-list'

describe('email-list helpers', () => {
  it('normalizes valid email addresses and rejects invalid ones', () => {
    expect(normalizeEmail(' Staff@Example.com ')).toBe('staff@example.com')
    expect(normalizeEmail('not-an-email')).toBeUndefined()
  })

  it('parses comma, newline, and semicolon separated addresses without duplicates', () => {
    expect(parseEmailList('staff@example.com, Nurse@example.com\nstaff@example.com; admin@example.com')).toEqual([
      'staff@example.com',
      'nurse@example.com',
      'admin@example.com',
    ])
  })
})
