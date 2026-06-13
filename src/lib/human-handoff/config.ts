import 'server-only'

import { parseEmailList } from '@/lib/email-list'
import { serverEnv } from '@/lib/env/server'

export interface ClinicSettingRowLike {
  key: string
  value: string
}

export type HumanHandoffRecipientReason = 'ready' | 'notifications_disabled' | 'no_recipients'
export type HumanHandoffConfigReason = HumanHandoffRecipientReason | 'provider_unconfigured'

interface HumanHandoffRecipientConfiguration {
  notificationsEnabled: boolean
  recipientEmails: string[]
  ready: boolean
  reason: HumanHandoffRecipientReason
  message: string | null
}

interface HumanHandoffDeliveryConfiguration extends Omit<HumanHandoffRecipientConfiguration, 'reason'> {
  providerConfigured: boolean
  reason: HumanHandoffConfigReason
}

function getSettingValue(rows: ClinicSettingRowLike[], key: string) {
  return rows.find((row) => row.key === key)?.value ?? null
}

export function isHumanHandoffProviderConfigured() {
  const configured = Boolean(serverEnv.MAILERSEND_API_KEY && serverEnv.MAILERSEND_FROM_EMAIL)

  if (!configured) {
    console.warn('[human-handoff:config] MailerSend provider configuration is incomplete', {
      hasApiKey: Boolean(serverEnv.MAILERSEND_API_KEY),
      hasFromEmail: Boolean(serverEnv.MAILERSEND_FROM_EMAIL),
    })
  }

  return configured
}

export function resolveHumanHandoffRecipients(settingsRows: ClinicSettingRowLike[]) {
  const enabled = getSettingValue(settingsRows, 'lead_notifications_enabled')
  const recipients = parseEmailList(getSettingValue(settingsRows, 'lead_notification_emails'))
  const notificationsEnabled = enabled !== 'false'
  const result = notificationsEnabled ? recipients : []

  console.info('[human-handoff:config] Resolved recipient list', {
    recipientCount: result.length,
    notificationsEnabled,
  })

  return result
}

export function getHumanHandoffRecipientConfiguration(
  settingsRows: ClinicSettingRowLike[],
): HumanHandoffRecipientConfiguration {
  const enabled = getSettingValue(settingsRows, 'lead_notifications_enabled')
  const notificationsEnabled = enabled !== 'false'
  const recipientEmails = resolveHumanHandoffRecipients(settingsRows)

  if (!notificationsEnabled) {
    return {
      notificationsEnabled,
      recipientEmails,
      ready: false,
      reason: 'notifications_disabled',
      message: 'Human handoff requires lead notifications to stay enabled.',
    }
  }

  if (recipientEmails.length === 0) {
    return {
      notificationsEnabled,
      recipientEmails,
      ready: false,
      reason: 'no_recipients',
      message: 'Human handoff requires at least one notification recipient email.',
    }
  }

  return {
    notificationsEnabled,
    recipientEmails,
    ready: true,
    reason: 'ready',
    message: null,
  }
}

export function getHumanHandoffDeliveryConfiguration(
  settingsRows: ClinicSettingRowLike[],
): HumanHandoffDeliveryConfiguration {
  const recipientConfiguration = getHumanHandoffRecipientConfiguration(settingsRows)
  const providerConfigured = isHumanHandoffProviderConfigured()

  if (!recipientConfiguration.ready) {
    return {
      ...recipientConfiguration,
      providerConfigured,
    }
  }

  if (!providerConfigured) {
    return {
      ...recipientConfiguration,
      providerConfigured,
      ready: false,
      reason: 'provider_unconfigured',
      message: 'MailerSend is not configured for human handoff notifications.',
    }
  }

  return {
    ...recipientConfiguration,
    providerConfigured,
    ready: true,
    reason: 'ready',
    message: null,
  }
}
