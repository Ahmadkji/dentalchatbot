import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  defaultAutomationState,
  extractAutomationFields,
  detectHumanHandoffIntent,
  shouldCreateAppointmentRequest,
  type AutomationTranscriptMessage,
} from '@/lib/chat/automation'

describe('chat automation helpers', () => {
  it('ignores assistant-sourced booking data', () => {
    const messages: AutomationTranscriptMessage[] = [
      { role: 'assistant', content: 'Call us at +1 415 555 0100 and book for 2026-07-02 at 15:30.' },
      { role: 'user', content: 'Hello there' },
    ]

    expect(extractAutomationFields(messages)).toEqual({
      email: undefined,
      phone: undefined,
      preferredDate: undefined,
      preferredTime: undefined,
    })

    expect(
      shouldCreateAppointmentRequest({
        state: defaultAutomationState(),
        messages,
      }),
    ).toBe(false)
  })

  it('creates appointment automation state only from user-supplied details', () => {
    const messages: AutomationTranscriptMessage[] = [
      { role: 'user', content: 'I want to book an appointment.' },
      { role: 'assistant', content: 'Sure, what date and time work for you?' },
      { role: 'user', content: 'My number is +1 415 555 0101.' },
      { role: 'user', content: 'Please schedule me for 2026-07-02 at 15:30.' },
    ]

    const fields = extractAutomationFields(messages)

    expect(fields).toEqual({
      email: undefined,
      phone: '+14155550101',
      preferredDate: '2026-07-02',
      preferredTime: '15:30',
    })

    expect(
      shouldCreateAppointmentRequest({
        state: {
          ...defaultAutomationState(),
          fields,
        },
        messages,
      }),
    ).toBe(true)
  })

  it('detects explicit human handoff requests', () => {
    expect(detectHumanHandoffIntent('Please connect me with a real person')).toBe(true)
    expect(detectHumanHandoffIntent('I want to talk to human support')).toBe(true)
    expect(detectHumanHandoffIntent('What are your office hours?')).toBe(false)
  })
})
