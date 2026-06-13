import type { HumanHandoffStatus } from '@/lib/human-handoff/types'

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const

export const HUMAN_HANDOFF_MAX_ATTEMPTS = 5
export const HUMAN_HANDOFF_LOCK_TIMEOUT_MS = 5 * 60 * 1000

export function getHumanHandoffRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 1) return RETRY_DELAYS_MS[0]
  if (attemptCount === 2) return RETRY_DELAYS_MS[1]
  if (attemptCount === 3) return RETRY_DELAYS_MS[2]
  return RETRY_DELAYS_MS[3]
}

export function getHumanHandoffNextAvailableAt(attemptCount: number, now = new Date()) {
  return new Date(now.getTime() + getHumanHandoffRetryDelayMs(attemptCount)).toISOString()
}

export function isHumanHandoffDeliveryCompleteStatus(status: HumanHandoffStatus | null | undefined) {
  return status === 'sent' || status === 'accepted' || status === 'delivered'
}

export function shouldPollHumanHandoffStatus(status: HumanHandoffStatus | null | undefined) {
  return status === 'queued' || status === 'sending' || status === 'sent' || status === 'accepted'
}
