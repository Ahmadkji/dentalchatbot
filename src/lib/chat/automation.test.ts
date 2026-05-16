import { describe, expect, it } from 'vitest'
import {
  buildSafeAssistantReply,
  canAnswerFromClinicProfile,
  defaultAutomationState,
  extractAutomationFields,
  mapLeadAutomationSettings,
  mergeAutomationState,
  shouldCreateAppointmentRequest,
  shouldCreateLead,
} from '@/lib/chat/automation'

describe('chat automation helpers', () => {
  it('maps lead settings from full clinic setting keys', () => {
    const settings = mapLeadAutomationSettings([
      { key: 'lead_collection_enabled', value: 'true' },
      { key: 'lead_trigger_mode', value: 'interest' },
      { key: 'lead_trigger_message_count', value: '2' },
      { key: 'lead_trigger_keywords', value: 'price,appointment' },
    ])

    expect(settings.triggerMode).toBe('interest')
    expect(settings.triggerMessageCount).toBe(2)
    expect(settings.triggerKeywords).toEqual(['price', 'appointment'])
  })

  it('extracts phone, email, date, and time from transcript text', () => {
    const fields = extractAutomationFields([
      'user: my phone is (415) 555-2671',
      'user: email me at hello@example.com',
      'user: 2026-05-30 at 10:30 am works',
    ])

    expect(fields.phone).toBe('+14155552671')
    expect(fields.email).toBe('hello@example.com')
    expect(fields.preferredDate).toBe('2026-05-30')
    expect(fields.preferredTime?.toLowerCase()).toContain('10:30')
  })

  it('creates a lead only once after trigger rules are met', () => {
    const state = mergeAutomationState(defaultAutomationState(), { phone: '+14155552671' })
    expect(
      shouldCreateLead({
        settings: mapLeadAutomationSettings([]),
        state,
        messageCount: 2,
        latestUserMessage: 'I want to book an appointment',
        supportLevel: 'medium',
      }),
    ).toBe(true)

    expect(
      shouldCreateLead({
        settings: mapLeadAutomationSettings([]),
        state: { ...state, leadId: 'lead-1' },
        messageCount: 3,
        latestUserMessage: 'following up',
        supportLevel: 'medium',
      }),
    ).toBe(false)
  })

  it('creates an appointment request only after phone, date, and time exist', () => {
    expect(
      shouldCreateAppointmentRequest({
        state: {
          leadId: 'lead-1',
          appointmentRequestId: null,
          fields: {
            phone: '+14155552671',
            preferredDate: '2026-05-30',
            preferredTime: '10:30',
          },
        },
        transcriptLines: ['user: I want to book an appointment for tomorrow'],
      }),
    ).toBe(true)
  })

  it('does not create a lead without a phone number even if phone collection is disabled', () => {
    expect(
      shouldCreateLead({
        settings: {
          ...mapLeadAutomationSettings([]),
          collectPhone: false,
        },
        state: defaultAutomationState(),
        messageCount: 3,
        latestUserMessage: 'please contact me about pricing',
        supportLevel: 'weak',
      }),
    ).toBe(false)
  })

  it('does not create an appointment request when booking intent is missing', () => {
    expect(
      shouldCreateAppointmentRequest({
        state: {
          leadId: 'lead-1',
          appointmentRequestId: null,
          fields: {
            phone: '+14155552671',
            preferredDate: '2026-05-30',
            preferredTime: '10:30',
          },
        },
        transcriptLines: ['user: our address is 2026-05-30 and my phone is 10:30'],
      }),
    ).toBe(false)
  })

  it('forces fallback on weak support', () => {
    expect(
      buildSafeAssistantReply({
        aiResponse: 'Maybe it costs 100',
        supportLevel: 'weak',
        fallbackMessage: 'Please contact the clinic directly so staff can help you correctly.',
        latestUserMessage: 'how much does it cost',
      }),
    ).toBe('Please contact the clinic directly so staff can help you correctly.')
  })

  it('keeps direct clinic-profile answers even when chunk support is weak', () => {
    expect(canAnswerFromClinicProfile('what are your hours')).toBe(true)

    expect(
      buildSafeAssistantReply({
        aiResponse: 'We are open Monday to Friday from 9 AM to 5 PM.',
        supportLevel: 'weak',
        fallbackMessage: 'Please contact the clinic directly so staff can help you correctly.',
        latestUserMessage: 'what are your hours',
      }),
    ).toBe('We are open Monday to Friday from 9 AM to 5 PM.')
  })
})
