import 'server-only'

import { serverEnv } from '@/lib/env/server'
import type { HumanHandoffRequestRow } from '@/lib/human-handoff/types'

interface SendHumanHandoffEmailInput {
  handoff: HumanHandoffRequestRow
  clinicName: string
  clinicSlug: string
  dashboardUrl: string
}

interface MailerSendSendResult {
  messageId: string
  status: number
  sendPaused: boolean
  warnings: string[]
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildPlainTextBody(input: SendHumanHandoffEmailInput) {
  const { handoff, clinicName, clinicSlug, dashboardUrl } = input
  return [
    `Human handoff requested for ${clinicName}`,
    `Clinic slug: ${clinicSlug}`,
    `Conversation ID: ${handoff.conversation_id}`,
    `Visitor name: ${handoff.visitor_name || 'Unknown'}`,
    `Visitor email: ${handoff.visitor_email || 'Unknown'}`,
    `Visitor phone: ${handoff.visitor_phone || 'Unknown'}`,
    `Source page: ${handoff.source_page || 'Unknown'}`,
    `Trigger source: ${handoff.trigger_source}`,
    `Latest user message: ${handoff.latest_user_message || '—'}`,
    `Assistant message: ${handoff.assistant_message || '—'}`,
    `Summary: ${handoff.summary || '—'}`,
    `Dashboard: ${dashboardUrl}`,
  ].join('\n')
}

function buildHtmlBody(input: SendHumanHandoffEmailInput) {
  const { handoff, clinicName, dashboardUrl } = input
  const rows = [
    ['Clinic', clinicName],
    ['Conversation', handoff.conversation_id],
    ['Visitor', handoff.visitor_name || 'Unknown'],
    ['Email', handoff.visitor_email || 'Unknown'],
    ['Phone', handoff.visitor_phone || 'Unknown'],
    ['Source page', handoff.source_page || 'Unknown'],
    ['Trigger', handoff.trigger_source],
    ['Latest message', handoff.latest_user_message || '—'],
    ['Assistant response', handoff.assistant_message || '—'],
    ['Summary', handoff.summary || '—'],
  ]

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h1 style="margin:0 0 16px;font-size:20px">Human handoff requested</h1>
      <p style="margin:0 0 16px">A visitor needs a human follow-up.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:720px">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th align="left" style="padding:8px 12px 8px 0;vertical-align:top;width:160px;color:#6b7280">${escapeHtml(label)}</th>
                  <td style="padding:8px 0;vertical-align:top">${escapeHtml(String(value || '—'))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
      <p style="margin:20px 0 0">
        <a href="${escapeHtml(dashboardUrl)}" style="color:#059669;text-decoration:none;font-weight:600">
          Open the conversation in the dashboard
        </a>
      </p>
    </div>
  `
}

export async function sendHumanHandoffEmail(input: SendHumanHandoffEmailInput): Promise<MailerSendSendResult> {
  if (!serverEnv.MAILERSEND_API_KEY || !serverEnv.MAILERSEND_FROM_EMAIL) {
    throw new Error('MailerSend is not configured for human handoff notifications.')
  }

  console.info('[human-handoff:mailersend] Sending staff notification email', {
    clinicSlug: input.clinicSlug,
    conversationId: input.handoff.conversation_id,
    recipientCount: input.handoff.recipient_emails.length,
  })

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serverEnv.MAILERSEND_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: {
        email: serverEnv.MAILERSEND_FROM_EMAIL,
        name: serverEnv.MAILERSEND_FROM_NAME || 'SmileWell',
      },
      to: input.handoff.recipient_emails.map((email) => ({ email })),
      subject: `Human handoff: ${input.clinicName}`,
      html: buildHtmlBody(input),
      text: buildPlainTextBody(input),
      tags: ['human-handoff'],
      settings: {
        track_clicks: false,
        track_opens: false,
        track_content: false,
      },
    }),
  })

  const responseText = await response.text().catch(() => '')
  const messageId = response.headers.get('x-message-id')?.trim() || ''
  const sendPaused = response.headers.get('x-send-paused')?.trim() === 'true'
  const responseJson = responseText
    ? ((() => {
        try {
          return JSON.parse(responseText) as { warnings?: Array<{ message?: string }> }
        } catch {
          return null
        }
      })())
    : null
  const warnings = Array.isArray(responseJson?.warnings)
    ? responseJson!.warnings
        .map((warning) => warning?.message?.trim())
        .filter((warning): warning is string => Boolean(warning))
    : []

  if (!response.ok) {
    console.error('[human-handoff:mailersend] MailerSend rejected the request', {
      clinicSlug: input.clinicSlug,
      conversationId: input.handoff.conversation_id,
      status: response.status,
      body: responseText.slice(0, 500),
    })
    throw new Error(`MailerSend request failed with status ${response.status}`)
  }

  if (!messageId) {
    console.error('[human-handoff:mailersend] MailerSend accepted the request without a message id', {
      clinicSlug: input.clinicSlug,
      conversationId: input.handoff.conversation_id,
      status: response.status,
      warnings,
      body: responseText.slice(0, 500),
    })
    throw new Error('MailerSend accepted the request without returning a message id.')
  }

  console.info('[human-handoff:mailersend] Staff notification accepted by MailerSend', {
    clinicSlug: input.clinicSlug,
    conversationId: input.handoff.conversation_id,
    status: response.status,
    messageId,
    sendPaused,
    warningCount: warnings.length,
  })

  return {
    messageId,
    status: response.status,
    sendPaused,
    warnings,
  }
}
