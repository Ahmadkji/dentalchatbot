import { describe, expect, it } from 'vitest'
import {
  clinicHoursReplaceSchema,
  formatClinicHoursSummary,
  hasConfirmedOpeningHours,
  isClinicOpenNow,
  normalizeClinicHours,
  type ClinicHourInput,
} from '@/lib/clinics/hours'

const fullWeek: ClinicHourInput[] = [
  { day_of_week: 0, is_open: false, open_time: null, close_time: null, break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 1, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: '13:00', break_end_time: '14:00', notes: 'Lunch break' },
  { day_of_week: 2, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 3, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 4, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 5, is_open: true, open_time: '09:00', close_time: '13:00', break_start_time: null, break_end_time: null, notes: 'Friday hours' },
  { day_of_week: 6, is_open: false, open_time: null, close_time: null, break_start_time: null, break_end_time: null, notes: 'By appointment only' },
]

describe('clinic hours helpers', () => {
  it('requires all 7 days', () => {
    expect(() => clinicHoursReplaceSchema.parse({ hours: fullWeek.slice(0, 5) })).toThrow(/7 days/i)
  })

  it('rejects invalid break windows', () => {
    const invalid = structuredClone(fullWeek)
    invalid[1] = {
      ...invalid[1],
      break_start_time: '18:30',
      break_end_time: '19:00',
    }

    expect(() => clinicHoursReplaceSchema.parse({ hours: invalid })).toThrow(/Break cannot end after closing time/i)
  })

  it('normalizes and sorts weekly hours', () => {
    const reversed = [...fullWeek].reverse()
    const normalized = normalizeClinicHours(reversed)
    expect(normalized[0].day_of_week).toBe(0)
    expect(normalized[1].notes).toBe('Lunch break')
  })

  it('formats a readable schedule summary', () => {
    const summary = formatClinicHoursSummary(normalizeClinicHours(fullWeek))
    expect(summary).toContain('Monday: 9 AM - 6 PM, break 1 PM - 2 PM (Lunch break)')
    expect(summary).toContain('Sunday: Closed')
  })

  it('tracks whether a clinic has confirmed hours', () => {
    expect(hasConfirmedOpeningHours(normalizeClinicHours(fullWeek))).toBe(true)
    expect(hasConfirmedOpeningHours([])).toBe(false)
  })

  it('computes open-now status in the clinic timezone', () => {
    const hours = normalizeClinicHours(fullWeek)

    expect(isClinicOpenNow(hours, 'Asia/Karachi', new Date('2026-05-11T05:30:00.000Z'))).toBe(true)
    expect(isClinicOpenNow(hours, 'Asia/Karachi', new Date('2026-05-11T08:30:00.000Z'))).toBe(false)
  })
})
