import { describe, expect, it } from 'vitest'
import { normalizeKnowledgeImportUrl } from '@/lib/knowledge-import'
import {
  estimateKnowledgeTokens,
  mapKnowledgeSource,
  splitKnowledgeContentIntoChunks,
} from '@/lib/knowledge/sources'

describe('knowledge helpers', () => {
  it('splits large content into stable chunks', () => {
    const content = [
      'Dental cleaning helps remove plaque and tartar buildup before it leads to gum disease. '.repeat(25).trim(),
      'Root canal treatment can save an infected tooth when deep decay reaches the pulp. '.repeat(25).trim(),
      'Teeth whitening is typically cosmetic and may require maintenance depending on diet and habits. '.repeat(25).trim(),
      'Emergency visits should be escalated when patients report severe pain, swelling, bleeding, or trauma. '.repeat(25).trim(),
    ].join('\n\n')

    const chunks = splitKnowledgeContentIntoChunks(content)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 4200)).toBe(true)
  })

  it('estimates tokens conservatively', () => {
    expect(estimateKnowledgeTokens('one two three four')).toBe(3)
    expect(estimateKnowledgeTokens('single')).toBe(1)
  })

  it('normalizes external import urls and rejects private hosts', () => {
    expect(normalizeKnowledgeImportUrl('example.com/services').toString()).toBe('https://example.com/services')
    expect(() => normalizeKnowledgeImportUrl('http://localhost:3000')).toThrow('Private or local network URLs are not allowed.')
    expect(() => normalizeKnowledgeImportUrl('ftp://example.com')).toThrow('Only http:// and https:// URLs are supported.')
    expect(() => normalizeKnowledgeImportUrl('http://192.168.1.10')).toThrow('Private or local network URLs are not allowed.')
  })

  it('maps snake_case knowledge rows to the current UI shape', () => {
    expect(
      mapKnowledgeSource({
        id: 'source-1',
        clinic_id: 'clinic-1',
        title: 'Homepage',
        source_type: 'website_url',
        content: 'hello world',
        source_url: 'https://example.com',
        file_name: null,
        file_type: null,
        status: 'trained',
        is_active: true,
        chunk_count: 2,
        trained_at: '2026-05-12T00:30:00Z',
        last_synced_at: '2026-05-12T00:00:00Z',
        failed_reason: null,
        metadata: {},
        created_at: '2026-05-12T00:00:00Z',
        updated_at: '2026-05-12T01:00:00Z',
      }),
    ).toEqual({
      id: 'source-1',
      title: 'Homepage',
      type: 'website',
      sourceType: 'website_url',
      content: 'hello world',
      sourceUrl: 'https://example.com',
      fileName: null,
      fileType: null,
      status: 'trained',
      isActive: true,
      chunkCount: 2,
      trainedAt: '2026-05-12T00:30:00Z',
      lastSyncedAt: '2026-05-12T00:00:00Z',
      errorMessage: null,
      metadata: {},
      updatedAt: '2026-05-12T01:00:00Z',
      createdAt: '2026-05-12T00:00:00Z',
    })
  })
})
