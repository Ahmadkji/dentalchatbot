import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env/server', () => ({
  serverEnv: {
    MAILERSEND_API_KEY: 'test-mailersend-key',
    MAILERSEND_FROM_EMAIL: 'handoff@smilewell.example',
    MAILERSEND_FROM_NAME: 'SmileWell',
  },
}))

import { sendHumanHandoffEmail } from '@/lib/human-handoff/mailersend'
import type { HumanHandoffRequestRow } from '@/lib/human-handoff/types'

const fetchMock = vi.fn()

const handoffRow: HumanHandoffRequestRow = {
  id: 'handoff-1',
  clinic_id: 'clinic-1',
  conversation_id: 'conversation-1',
  lead_id: null,
  trigger_source: 'user_request',
  status: 'queued',
  recipient_emails: ['staff@example.com'],
  visitor_name: 'Alex Patient',
  visitor_email: 'alex@example.com',
  visitor_phone: '+14155550101',
  source_page: 'https://clinic.example.com/contact',
  latest_user_message: 'I want to talk to a human.',
  assistant_message: 'Thanks for your message. A human team member will reply shortly.',
  summary: 'Visitor asked for human follow-up.',
  provider: 'mailersend',
  provider_message_id: null,
  attempt_count: 0,
  last_attempt_at: null,
  available_at: '2026-06-13T00:00:00.000Z',
  locked_at: null,
  locked_by: null,
  sent_at: null,
  provider_accepted_at: null,
  provider_delivered_at: null,
  provider_last_event: null,
  provider_last_event_at: null,
  last_error: null,
  created_at: '2026-06-13T00:00:00.000Z',
  updated_at: '2026-06-13T00:00:00.000Z',
}

describe('sendHumanHandoffEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('sends a MailerSend request with the verified sender and recipient list', async () => {
    fetchMock.mockResolvedValue(
      new Response('', {
        status: 202,
        headers: {
          'x-message-id': 'message-123',
        },
      }),
    )

    const result = await sendHumanHandoffEmail({
      handoff: handoffRow,
      clinicName: 'SmileWell Dental',
      clinicSlug: 'smilewell',
      dashboardUrl: 'https://app.example.com/dashboard/inbox',
    })

    expect(result).toEqual({ status: 202, messageId: 'message-123', sendPaused: false, warnings: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.mailersend.com/v1/email')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-mailersend-key',
      'Content-Type': 'application/json',
    })

    const payload = JSON.parse(String(init.body)) as {
      from: { email: string; name: string }
      to: Array<{ email: string }>
      subject: string
      text: string
    }

    expect(payload.from).toEqual({
      email: 'handoff@smilewell.example',
      name: 'SmileWell',
    })
    expect(payload.to).toEqual([{ email: 'staff@example.com' }])
    expect(payload.subject).toContain('Human handoff')
    expect(payload.text).toContain('Visitor asked for human follow-up.')
  })

  it('fails when MailerSend accepts the request without returning a message id', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ warnings: [{ message: 'Email was not sent.' }] }), { status: 202 }))

    await expect(
      sendHumanHandoffEmail({
        handoff: handoffRow,
        clinicName: 'SmileWell Dental',
        clinicSlug: 'smilewell',
        dashboardUrl: 'https://app.example.com/dashboard/inbox',
      }),
    ).rejects.toThrow('MailerSend accepted the request without returning a message id.')
  })
})
