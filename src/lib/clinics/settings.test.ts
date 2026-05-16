import { describe, expect, it } from 'vitest'
import {
  mapLeadSettings,
  normalizeLeadCustomFieldInput,
  normalizeLeadSettingsInput,
  serializeClinicSettingValue,
} from '@/lib/clinics/settings'

describe('clinic settings helpers', () => {
  it('maps lead settings by removing the lead_ prefix', () => {
    expect(
      mapLeadSettings([
        {
          id: '1',
          clinic_id: 'clinic-1',
          key: 'lead_collect_phone',
          value: 'true',
          category: 'lead-collection',
          description: null,
          created_at: '2026-05-12T00:00:00Z',
          updated_at: '2026-05-12T00:00:00Z',
        },
        {
          id: '2',
          clinic_id: 'clinic-1',
          key: 'ai_personality',
          value: 'friendly_professional',
          category: 'ai',
          description: null,
          created_at: '2026-05-12T00:00:00Z',
          updated_at: '2026-05-12T00:00:00Z',
        },
      ]),
    ).toEqual({
      collect_phone: 'true',
    })
  })

  it('normalizes lead setting updates and ignores unknown keys', () => {
    expect(
      normalizeLeadSettingsInput({
        collection_enabled: false,
        notification_emails: ['a@example.com', 'b@example.com'],
        random_key: 'ignore-me',
      }),
    ).toEqual({
      lead_collection_enabled: 'false',
      lead_notification_emails: '["a@example.com","b@example.com"]',
    })
  })

  it('serializes structured values safely for storage', () => {
    expect(serializeClinicSettingValue(true)).toBe('true')
    expect(serializeClinicSettingValue(15)).toBe('15')
    expect(serializeClinicSettingValue(['phone', 'address'])).toBe('["phone","address"]')
    expect(serializeClinicSettingValue(null)).toBe('')
  })

  it('normalizes lead custom fields into database column names', () => {
    expect(
      normalizeLeadCustomFieldInput({
        label: 'Insurance Provider',
        fieldType: 'select',
        required: true,
        options: ['Aetna', 'Aetna', ' Blue Cross '],
        placeholder: 'Choose one',
        order: 3,
      }),
    ).toEqual({
      label: 'Insurance Provider',
      field_type: 'select',
      required: true,
      options: ['Aetna', 'Blue Cross'],
      placeholder: 'Choose one',
      sort_order: 3,
    })
  })
})
