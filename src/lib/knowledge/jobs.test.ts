import { describe, expect, it } from 'vitest'
import {
  getKnowledgeJobRetryDelaySeconds,
  isPermanentKnowledgeJobError,
  isValidKnowledgeRunnerSecret,
  normalizeKnowledgeJobLimit,
  shouldRetryKnowledgeJob,
  type KnowledgeJobRow,
} from '@/lib/knowledge/jobs'

function buildJob(overrides?: Partial<KnowledgeJobRow>): KnowledgeJobRow {
  return {
    id: 'job-1',
    clinic_id: 'clinic-1',
    source_id: 'source-1',
    job_type: 'process_source_content',
    status: 'queued',
    payload: {},
    attempt_count: 1,
    max_attempts: 3,
    available_at: '2026-05-14T00:00:00Z',
    started_at: null,
    finished_at: null,
    locked_at: null,
    locked_by: null,
    last_error: null,
    created_by: 'user-1',
    created_at: '2026-05-14T00:00:00Z',
    updated_at: '2026-05-14T00:00:00Z',
    ...overrides,
  }
}

describe('knowledge job helpers', () => {
  it('clamps queue processing limits to a small safe batch', () => {
    expect(normalizeKnowledgeJobLimit(undefined)).toBe(1)
    expect(normalizeKnowledgeJobLimit(0)).toBe(1)
    expect(normalizeKnowledgeJobLimit(2)).toBe(2)
    expect(normalizeKnowledgeJobLimit(50)).toBe(5)
  })

  it('classifies permanent job failures conservatively', () => {
    expect(isPermanentKnowledgeJobError('No readable text found. Please upload a text-based PDF or DOCX.')).toBe(true)
    expect(isPermanentKnowledgeJobError('Private or local network URLs are not allowed.')).toBe(true)
    expect(isPermanentKnowledgeJobError('Website returned 503')).toBe(false)
  })

  it('retries only transient failures while attempts remain', () => {
    expect(shouldRetryKnowledgeJob(buildJob({ attempt_count: 1, max_attempts: 3 }), new Error('Website returned 503'))).toBe(true)
    expect(shouldRetryKnowledgeJob(buildJob({ attempt_count: 3, max_attempts: 3 }), new Error('Website returned 503'))).toBe(false)
    expect(
      shouldRetryKnowledgeJob(
        buildJob({ attempt_count: 1, max_attempts: 3 }),
        new Error('No readable text found. Please upload a text-based PDF or DOCX.'),
      ),
    ).toBe(false)
  })

  it('stages retry delays instead of hammering the same source', () => {
    expect(getKnowledgeJobRetryDelaySeconds(1)).toBe(120)
    expect(getKnowledgeJobRetryDelaySeconds(2)).toBe(300)
    expect(getKnowledgeJobRetryDelaySeconds(5)).toBe(900)
  })

  it('validates internal runner secrets without plain equality checks', () => {
    expect(isValidKnowledgeRunnerSecret('super-secret', 'super-secret')).toBe(true)
    expect(isValidKnowledgeRunnerSecret('super-secret', 'wrong-secret')).toBe(false)
    expect(isValidKnowledgeRunnerSecret(null, 'super-secret')).toBe(false)
  })
})
