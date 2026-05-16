import { describe, expect, it } from 'vitest'
import {
  clinicProfileUpdateSchema,
  isValidTimezone,
  normalizeClinicProfileUpdate,
  normalizePhoneNumber,
  normalizeServiceInput,
  normalizeOptionalHttpsUrl,
  serviceCreateSchema,
} from '@/lib/clinics/validation'

describe('clinic validation helpers', () => {
  it('validates supported timezones', () => {
    expect(isValidTimezone('Asia/Karachi')).toBe(true)
    expect(isValidTimezone('Mars/Phobos')).toBe(false)
  })

  it('normalizes valid phone numbers to E.164', () => {
    expect(normalizePhoneNumber('+92 300 1234567')).toBe('+923001234567')
  })

  it('rejects invalid phone numbers', () => {
    expect(() => normalizePhoneNumber('03001234567')).toThrow(/E\.164/i)
  })

  it('normalizes https urls and adds a protocol when missing', () => {
    expect(normalizeOptionalHttpsUrl('example.com/services')).toBe('https://example.com/services')
    expect(normalizeOptionalHttpsUrl('https://example.com/')).toBe('https://example.com')
  })

  it('normalizes clinic profile payloads', () => {
    const parsed = clinicProfileUpdateSchema.parse({
      name: '  Smile   Dental Clinic  ',
      phone: '+92 300 1234567',
      website_url: 'example.com',
      emergency_instructions: '  Call the clinic immediately for severe pain.  ',
    })

    expect(normalizeClinicProfileUpdate(parsed)).toMatchObject({
      name: 'Smile Dental Clinic',
      phone: '+923001234567',
      website_url: 'https://example.com',
      emergency_instructions: 'Call the clinic immediately for severe pain.',
    })
  })

  it('normalizes service payloads', () => {
    const parsed = serviceCreateSchema.parse({
      name: ' Teeth Cleaning ',
      duration_minutes: 45,
      price_amount: '8000',
      price_currency: 'pkr',
      pricing_note: '  Final price may vary after consultation. ',
    })

    expect(normalizeServiceInput(parsed)).toMatchObject({
      name: 'Teeth Cleaning',
      duration_minutes: 45,
      price_amount: 8000,
      price_currency: 'PKR',
      pricing_note: 'Final price may vary after consultation.',
    })
  })
})
