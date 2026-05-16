import { describe, it, expect } from 'vitest'
import {
  WIDGET_QUICK_PROMPT_INTENTS,
  normalizeWidgetQuickPromptIntent,
  isSupportedWidgetQuickPromptIntent,
  messageForWidgetQuickPromptIntent,
  actionTypeForWidgetQuickPromptIntent,
  actionValueForWidgetQuickPromptIntent,
  mapWidgetQuickPromptRow,
  type QuickPromptRow,
} from '@/lib/widget/quick-prompts'

// ─── Shared helper: normalizeWidgetQuickPromptIntent ──────────

describe('normalizeWidgetQuickPromptIntent', () => {
  it('lowercases and trims valid intent', () => {
    expect(normalizeWidgetQuickPromptIntent('  Book_Appointment  ')).toBe('book_appointment')
  })

  it('replaces non-alphanumeric runs with underscore', () => {
    expect(normalizeWidgetQuickPromptIntent('Services & Fees')).toBe('services_fees')
  })

  it('strips leading/trailing underscores', () => {
    expect(normalizeWidgetQuickPromptIntent('!!talk on whatsapp!!')).toBe('talk_on_whatsapp')
  })

  it('returns empty string for empty/null input', () => {
    expect(normalizeWidgetQuickPromptIntent('')).toBe('')
    // @ts-expect-error — testing runtime guard
    expect(normalizeWidgetQuickPromptIntent(null)).toBe('')
    // @ts-expect-error — testing runtime guard
    expect(normalizeWidgetQuickPromptIntent(undefined)).toBe('')
  })
})

// ─── Shared helper: isSupportedWidgetQuickPromptIntent ────────

describe('isSupportedWidgetQuickPromptIntent', () => {
  it.each(WIDGET_QUICK_PROMPT_INTENTS)('accepts supported intent: %s', (intent) => {
    expect(isSupportedWidgetQuickPromptIntent(intent)).toBe(true)
  })

  it('rejects unsupported intent', () => {
    expect(isSupportedWidgetQuickPromptIntent('custom_action')).toBe(false)
    expect(isSupportedWidgetQuickPromptIntent('')).toBe(false)
    expect(isSupportedWidgetQuickPromptIntent('appointment_request')).toBe(false)
  })
})

// ─── Shared helper: messageForWidgetQuickPromptIntent ────────

describe('messageForWidgetQuickPromptIntent', () => {
  it('returns a known message for each supported intent', () => {
    for (const intent of WIDGET_QUICK_PROMPT_INTENTS) {
      const msg = messageForWidgetQuickPromptIntent(intent, 'Fallback')
      expect(msg.length).toBeGreaterThan(0)
      // Known intents should return their specific message, not the fallback
      expect(msg).not.toBe('Fallback')
    }
  })

  it('returns label as fallback for unknown intent', () => {
    expect(messageForWidgetQuickPromptIntent('unknown_intent', 'My Label')).toBe('My Label')
  })
})

// ─── Shared helper: actionTypeForWidgetQuickPromptIntent ──────

describe('actionTypeForWidgetQuickPromptIntent', () => {
  it('returns appointment for book_appointment', () => {
    expect(actionTypeForWidgetQuickPromptIntent('book_appointment')).toBe('appointment')
  })

  it('returns link for talk_on_whatsapp', () => {
    expect(actionTypeForWidgetQuickPromptIntent('talk_on_whatsapp')).toBe('link')
  })

  it.each(['clinic_hours', 'services_fees', 'location', 'emergency_help'])(
    'returns message for intent: %s',
    (intent) => {
      expect(actionTypeForWidgetQuickPromptIntent(intent)).toBe('message')
    },
  )
})

// ─── Shared helper: actionValueForWidgetQuickPromptIntent ─────

describe('actionValueForWidgetQuickPromptIntent', () => {
  it('returns wa.me link for talk_on_whatsapp with whatsapp number', () => {
    expect(actionValueForWidgetQuickPromptIntent('talk_on_whatsapp', { whatsapp: '+923001234567' }))
      .toBe('https://wa.me/923001234567')
  })

  it('strips leading + from whatsapp number', () => {
    expect(actionValueForWidgetQuickPromptIntent('talk_on_whatsapp', { whatsapp: '+1234567890' }))
      .toBe('https://wa.me/1234567890')
  })

  it('returns null for talk_on_whatsapp without whatsapp number', () => {
    expect(actionValueForWidgetQuickPromptIntent('talk_on_whatsapp', { whatsapp: null })).toBeNull()
    expect(actionValueForWidgetQuickPromptIntent('talk_on_whatsapp', { whatsapp: '' })).toBeNull()
    expect(actionValueForWidgetQuickPromptIntent('talk_on_whatsapp')).toBeNull()
  })

  it('returns null for all non-whatsapp intents', () => {
    expect(actionValueForWidgetQuickPromptIntent('book_appointment', { whatsapp: '+123456' })).toBeNull()
    expect(actionValueForWidgetQuickPromptIntent('clinic_hours', { whatsapp: '+123456' })).toBeNull()
  })
})

// ─── Shared helper: mapWidgetQuickPromptRow ────────────────────

describe('mapWidgetQuickPromptRow', () => {
  const baseRow: QuickPromptRow = {
    id: 'prompt-1',
    clinic_id: 'clinic-1',
    label: 'Book Appointment',
    intent: 'book_appointment',
    sort_order: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('maps snake_case DB row to camelCase API response', () => {
    const result = mapWidgetQuickPromptRow(baseRow)
    expect(result).toEqual({
      id: 'prompt-1',
      clinicId: 'clinic-1',
      label: 'Book Appointment',
      intent: 'book_appointment',
      message: "I'd like to book an appointment",
      actionType: 'appointment',
      actionValue: null,
      sortOrder: 1,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('enriches actionValue for WhatsApp prompt when clinic has whatsapp', () => {
    const whatsappRow = { ...baseRow, intent: 'talk_on_whatsapp', label: 'Talk on WhatsApp' }
    const result = mapWidgetQuickPromptRow(whatsappRow, { whatsapp: '+923001234567' })
    expect(result.actionType).toBe('link')
    expect(result.actionValue).toBe('https://wa.me/923001234567')
  })

  it('returns label as fallback message for unknown intent', () => {
    const unknownRow = { ...baseRow, intent: 'custom_action', label: 'Custom Prompt' }
    const result = mapWidgetQuickPromptRow(unknownRow)
    expect(result.message).toBe('Custom Prompt')
    expect(result.actionType).toBe('message')
  })

  it('preserves all fields through mapping round-trip', () => {
    const result = mapWidgetQuickPromptRow(baseRow)
    expect(result.id).toBe(baseRow.id)
    expect(result.clinicId).toBe(baseRow.clinic_id)
    expect(result.sortOrder).toBe(baseRow.sort_order)
    expect(result.isActive).toBe(baseRow.is_active)
    expect(result.createdAt).toBe(baseRow.created_at)
    expect(result.updatedAt).toBe(baseRow.updated_at)
  })
})

// ─── Widget settings validation constants ──────────────────────

describe('widget settings validation', () => {
  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
  const VALID_POSITIONS = new Set(['bottom-right', 'bottom-left'])

  describe('primaryColor hex validation', () => {
    it('accepts valid 6-digit hex colors', () => {
      expect(HEX_COLOR_RE.test('#059669')).toBe(true)
      expect(HEX_COLOR_RE.test('#000000')).toBe(true)
      expect(HEX_COLOR_RE.test('#FFFFFF')).toBe(true)
      expect(HEX_COLOR_RE.test('#ff5733')).toBe(true)
    })

    it('rejects invalid values', () => {
      expect(HEX_COLOR_RE.test('')).toBe(false)
      expect(HEX_COLOR_RE.test('red')).toBe(false)
      expect(HEX_COLOR_RE.test('#123')).toBe(false)
      expect(HEX_COLOR_RE.test('#12345')).toBe(false)
      expect(HEX_COLOR_RE.test('#1234567')).toBe(false)
      expect(HEX_COLOR_RE.test('059669')).toBe(false)
      expect(HEX_COLOR_RE.test('#gggggg')).toBe(false)
    })
  })

  describe('widgetPosition validation', () => {
    it('accepts valid positions', () => {
      expect(VALID_POSITIONS.has('bottom-right')).toBe(true)
      expect(VALID_POSITIONS.has('bottom-left')).toBe(true)
    })

    it('rejects invalid positions', () => {
      expect(VALID_POSITIONS.has('top-right')).toBe(false)
      expect(VALID_POSITIONS.has('bottom_center')).toBe(false)
      expect(VALID_POSITIONS.has('')).toBe(false)
      expect(VALID_POSITIONS.has('right')).toBe(false)
    })
  })
})
