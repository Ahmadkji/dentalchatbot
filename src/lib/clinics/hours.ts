import 'server-only'

import { z } from 'zod'

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const timeValue = z.string().regex(/^\d{2}:\d{2}$/, 'Time must use HH:MM format.')

const clinicHourSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  open_time: timeValue.nullable().optional(),
  close_time: timeValue.nullable().optional(),
  break_start_time: timeValue.nullable().optional(),
  break_end_time: timeValue.nullable().optional(),
  notes: z.string().trim().max(240).nullable().optional(),
}).superRefine((value, ctx) => {
  const open = value.open_time ?? null
  const close = value.close_time ?? null
  const breakStart = value.break_start_time ?? null
  const breakEnd = value.break_end_time ?? null

  if (value.is_open) {
    if (!open || !close) {
      ctx.addIssue({ code: 'custom', message: 'Open days require open_time and close_time.' })
      return
    }

    if (close <= open) {
      ctx.addIssue({ code: 'custom', message: 'close_time must be after open_time for MVP hours.' })
    }

    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      ctx.addIssue({ code: 'custom', message: 'Break start and end must both be provided.' })
    }

    if (breakStart && breakEnd) {
      if (breakEnd <= breakStart) {
        ctx.addIssue({ code: 'custom', message: 'break_end_time must be after break_start_time.' })
      }

      if (open && breakStart < open) {
        ctx.addIssue({ code: 'custom', message: 'Break cannot start before opening time.' })
      }

      if (close && breakEnd > close) {
        ctx.addIssue({ code: 'custom', message: 'Break cannot end after closing time.' })
      }
    }
  } else if (open || close || breakStart || breakEnd) {
    ctx.addIssue({ code: 'custom', message: 'Closed days cannot include opening or break times.' })
  }
})

export const clinicHoursReplaceSchema = z.object({
  hours: z.array(clinicHourSchema).length(7, 'Clinic hours payload must contain all 7 days.'),
}).superRefine((value, ctx) => {
  const daySet = new Set(value.hours.map((row) => row.day_of_week))
  if (daySet.size !== 7) {
    ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Clinic hours must include each day exactly once.' })
  }
})

export type ClinicHourInput = z.infer<typeof clinicHourSchema>

export interface ClinicHourRecord {
  id?: string
  clinic_id?: string
  day_of_week: number
  is_open: boolean
  open_time: string | null
  close_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  notes: string | null
}

function normalizeTime(value: string | null | undefined) {
  return value ?? null
}

export function normalizeClinicHours(hours: ClinicHourInput[]): ClinicHourRecord[] {
  return [...hours]
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((row) => ({
      day_of_week: row.day_of_week,
      is_open: row.is_open,
      open_time: row.is_open ? normalizeTime(row.open_time ?? null) : null,
      close_time: row.is_open ? normalizeTime(row.close_time ?? null) : null,
      break_start_time: row.is_open ? normalizeTime(row.break_start_time ?? null) : null,
      break_end_time: row.is_open ? normalizeTime(row.break_end_time ?? null) : null,
      notes: row.notes?.trim() || null,
    }))
}

function formatLabel(time: string) {
  const [hourString, minuteString] = time.split(':')
  let hour = Number(hourString)
  const minutes = Number(minuteString)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  if (hour === 0) hour = 12
  else if (hour > 12) hour -= 12
  const minutePart = minutes === 0 ? '' : `:${minuteString}`
  return `${hour}${minutePart} ${suffix}`
}

export function formatClinicHoursSummary(hours: ClinicHourRecord[]) {
  const sorted = [...hours].sort((a, b) => a.day_of_week - b.day_of_week)
  if (sorted.length === 0) {
    return 'The clinic has not added confirmed opening hours yet.'
  }

  return sorted
    .map((row) => {
      const dayName = DAY_NAMES[row.day_of_week]
      if (!row.is_open) {
        return `${dayName}: Closed${row.notes ? ` (${row.notes})` : ''}`
      }

      const window = `${formatLabel(row.open_time || '00:00')} - ${formatLabel(row.close_time || '00:00')}`
      const breakWindow = row.break_start_time && row.break_end_time
        ? `, break ${formatLabel(row.break_start_time)} - ${formatLabel(row.break_end_time)}`
        : ''
      const notes = row.notes ? ` (${row.notes})` : ''
      return `${dayName}: ${window}${breakWindow}${notes}`
    })
    .join('\n')
}

function minutesFromTime(time: string | null) {
  if (!time) return null
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function isClinicOpenNow(hours: ClinicHourRecord[], timezone: string, now = new Date()) {
  if (hours.length === 0) return false

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = parts.find((part) => part.type === 'hour')?.value
  const minute = parts.find((part) => part.type === 'minute')?.value

  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday || '')
  if (dayIndex === -1) return false

  const currentMinutes = Number(hour) * 60 + Number(minute)
  const row = hours.find((entry) => entry.day_of_week === dayIndex)
  if (!row?.is_open) return false

  const openMinutes = minutesFromTime(row.open_time)
  const closeMinutes = minutesFromTime(row.close_time)
  if (openMinutes === null || closeMinutes === null) return false

  if (currentMinutes < openMinutes || currentMinutes >= closeMinutes) {
    return false
  }

  const breakStart = minutesFromTime(row.break_start_time)
  const breakEnd = minutesFromTime(row.break_end_time)
  if (breakStart !== null && breakEnd !== null && currentMinutes >= breakStart && currentMinutes < breakEnd) {
    return false
  }

  return true
}

export function hasConfirmedOpeningHours(hours: ClinicHourRecord[]) {
  return hours.length === 7 && hours.some((row) => row.is_open || Boolean(row.notes))
}
