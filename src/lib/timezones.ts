export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

export type CommonTimezone = (typeof COMMON_TIMEZONES)[number]

export function formatTimezoneLabel(timezone: string) {
  return timezone.replace(/_/g, ' ')
}
