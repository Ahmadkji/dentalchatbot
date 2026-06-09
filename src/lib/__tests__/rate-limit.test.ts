import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  apiRateKey,
  authEmailKey,
  authIpKey,
  widgetConfigKey,
  widgetChatKey,
  widgetEventsKey,
  widgetAppointmentKey,
  widgetClinicKey,
} from '@/lib/rate-limit'

describe('rate-limit key helpers', () => {
  describe('widgetChatKey (IP-based)', () => {
    it('generates key using only IP', () => {
      const result = widgetChatKey('1.2.3.4')
      expect(result.key).toBe('widget-chat:1.2.3.4')
      expect(result.limit).toBe(20)
      expect(result.windowMs).toBe(60_000)
    })

    it('uses same key for same IP regardless of visitorId', () => {
      const result1 = widgetChatKey('1.2.3.4')
      const result2 = widgetChatKey('1.2.3.4')
      expect(result1.key).toBe(result2.key)
    })
  })

  describe('widgetEventsKey (IP-based)', () => {
    it('generates key using only IP', () => {
      const result = widgetEventsKey('5.6.7.8')
      expect(result.key).toBe('widget-events:5.6.7.8')
      expect(result.limit).toBe(60)
      expect(result.windowMs).toBe(60_000)
    })

    it('no longer includes visitorId in the key', () => {
      const result = widgetEventsKey('5.6.7.8')
      expect(result.key).not.toContain('v_')
    })
  })

  describe('widgetAppointmentKey (IP-based)', () => {
    it('generates key using only IP', () => {
      const result = widgetAppointmentKey('9.10.11.12')
      expect(result.key).toBe('widget-appt:9.10.11.12')
      expect(result.limit).toBe(5)
      expect(result.windowMs).toBe(60_000)
    })
  })

  describe('widgetClinicKey (per-clinic global cap)', () => {
    it('generates key using clinic ID', () => {
      const result = widgetClinicKey('clinic-uuid-123')
      expect(result.key).toBe('widget-clinic:clinic-uuid-123')
      expect(result.limit).toBe(600)
      expect(result.windowMs).toBe(60_000)
    })

    it('different clinics get different keys', () => {
      const clinic1 = widgetClinicKey('clinic-a')
      const clinic2 = widgetClinicKey('clinic-b')
      expect(clinic1.key).not.toBe(clinic2.key)
    })
  })

  describe('other rate limit keys (unchanged)', () => {
    it('apiRateKey uses IP', () => {
      const result = apiRateKey('1.1.1.1')
      expect(result.key).toBe('api:1.1.1.1')
      expect(result.limit).toBe(100)
    })

    it('authEmailKey uses email', () => {
      const result = authEmailKey('  Test@Example.COM  ')
      expect(result.key).toBe('auth-email:test@example.com')
    })

    it('authIpKey uses IP', () => {
      const result = authIpKey('2.2.2.2')
      expect(result.key).toBe('auth-ip:2.2.2.2')
    })

    it('widgetConfigKey uses IP', () => {
      const result = widgetConfigKey('3.3.3.3')
      expect(result.key).toBe('widget-config:3.3.3.3')
    })
  })
})
