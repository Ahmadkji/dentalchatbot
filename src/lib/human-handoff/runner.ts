import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { deliverHumanHandoffRequest } from '@/lib/human-handoff/service'
import {
  HUMAN_HANDOFF_LOCK_TIMEOUT_MS,
  HUMAN_HANDOFF_MAX_ATTEMPTS,
} from '@/lib/human-handoff/status'
import { HANDOFF_SELECT_COLUMNS, getHumanHandoffRunnerName } from '@/lib/human-handoff/store'
import type { HumanHandoffRequestRow } from '@/lib/human-handoff/types'
import { getSiteUrl } from '@/lib/site-url'

interface ProcessHumanHandoffInput {
  limit?: number
  runner?: string
}

export async function processQueuedHumanHandoffRequests(
  input: ProcessHumanHandoffInput = {},
) {
  const adminClient = createSupabaseAdminClient()
  const limit = Math.min(Math.max(Number(input.limit ?? 3), 1), 10)
  const runner = getHumanHandoffRunnerName(input.runner)
  const nowIso = new Date().toISOString()
  const staleLockBefore = new Date(Date.now() - HUMAN_HANDOFF_LOCK_TIMEOUT_MS).toISOString()

  console.info('[human-handoff:runner] Processing queued human handoff requests', {
    runner,
    limit,
  })

  const [queuedRowsResult, staleSendingRowsResult] = await Promise.all([
    adminClient
      .from('human_handoff_requests')
      .select(HANDOFF_SELECT_COLUMNS)
      .in('status', ['queued', 'failed'])
      .lt('attempt_count', HUMAN_HANDOFF_MAX_ATTEMPTS)
      .lte('available_at', nowIso)
      .order('available_at', { ascending: true })
      .limit(limit),
    adminClient
      .from('human_handoff_requests')
      .select(HANDOFF_SELECT_COLUMNS)
      .eq('status', 'sending')
      .lte('locked_at', staleLockBefore)
      .order('locked_at', { ascending: true })
      .limit(limit),
  ])

  if (queuedRowsResult.error) {
    console.error('[human-handoff:runner] Failed to load queued handoff requests', {
      runner,
      error: queuedRowsResult.error.message,
    })
    throw queuedRowsResult.error
  }

  if (staleSendingRowsResult.error) {
    console.error('[human-handoff:runner] Failed to load stale sending handoff requests', {
      runner,
      error: staleSendingRowsResult.error.message,
    })
    throw staleSendingRowsResult.error
  }

  const dueRowsById = new Map<string, HumanHandoffRequestRow>()
  const queuedRows = (queuedRowsResult.data ?? []) as unknown as HumanHandoffRequestRow[]
  const staleSendingRows = (staleSendingRowsResult.data ?? []) as unknown as HumanHandoffRequestRow[]

  for (const row of [...queuedRows, ...staleSendingRows]) {
    dueRowsById.set(row.id, row)
  }

  const dueRows = Array.from(dueRowsById.values())
    .sort((left, right) => left.available_at.localeCompare(right.available_at))
    .slice(0, limit)

  const clinicIds = Array.from(new Set(dueRows.map((row) => row.clinic_id)))
  const { data: clinics, error: clinicsError } = clinicIds.length
    ? await adminClient
        .from('clinic_ai_profile_view')
        .select('clinic_id,name,slug')
        .in('clinic_id', clinicIds)
    : { data: [], error: null }

  if (clinicsError) {
    console.error('[human-handoff:runner] Failed to resolve clinic metadata', {
      runner,
      error: clinicsError.message,
      clinicCount: clinicIds.length,
    })
    throw clinicsError
  }

  const clinicRows = (clinics ?? []) as Array<{ clinic_id: string; name: string | null; slug: string | null }>
  const clinicMap = new Map<string, { name: string; slug: string }>(
    clinicRows.map((clinic) => [
      clinic.clinic_id,
      {
        name: clinic.name || 'Clinic',
        slug: clinic.slug || 'clinic',
      },
    ]),
  )

  let delivered = 0
  let failed = 0
  const dashboardUrl = `${getSiteUrl()}/dashboard/inbox`

  for (const row of dueRows) {
    const clinic = clinicMap.get(row.clinic_id)
    if (!clinic) {
      console.error('[human-handoff:runner] Missing clinic metadata for handoff request', {
        runner,
        requestId: row.id,
        clinicId: row.clinic_id,
      })
      failed += 1
      continue
    }

    const result = await deliverHumanHandoffRequest(adminClient, {
      requestId: row.id,
      clinicName: clinic.name,
      clinicSlug: clinic.slug,
      dashboardUrl,
      runner,
    })

    if (result.delivered) {
      delivered += 1
    } else {
      failed += 1
    }
  }

  console.info('[human-handoff:runner] Finished processing queued human handoff requests', {
    runner,
    limit,
    queued: dueRows.length,
    delivered,
    failed,
  })

  return {
    queued: dueRows.length,
    delivered,
    failed,
  }
}
