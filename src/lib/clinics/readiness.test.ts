import { describe, expect, it } from 'vitest'
import { getClinicReadiness } from '@/lib/clinics/readiness'

const hours = [
  { day_of_week: 0, is_open: false, open_time: null, close_time: null, break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 1, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 2, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 3, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 4, is_open: true, open_time: '09:00', close_time: '18:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 5, is_open: true, open_time: '09:00', close_time: '13:00', break_start_time: null, break_end_time: null, notes: null },
  { day_of_week: 6, is_open: false, open_time: null, close_time: null, break_start_time: null, break_end_time: null, notes: null },
]

describe('clinic readiness', () => {
  it('marks the clinic ready when required fields exist', () => {
    expect(getClinicReadiness({
      clinic: {
        phone: '+923001234567',
        address: 'Main Boulevard, Lahore',
        emergency_instructions: 'Call the clinic immediately for severe pain or bleeding.',
        timezone: 'Asia/Karachi',
      },
      hours,
      activeServicesCount: 2,
    })).toEqual({
      can_go_live: true,
      missing: [],
    })
  })

  it('reports missing go-live blockers', () => {
    expect(getClinicReadiness({
      clinic: {
        phone: null,
        address: '',
        emergency_instructions: null,
        timezone: 'Mars/Phobos',
      },
      hours: [],
      activeServicesCount: 0,
    })).toEqual({
      can_go_live: false,
      missing: ['phone', 'address', 'timezone', 'emergency_instructions', 'opening_hours', 'services'],
    })
  })
})
