import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}))

import { lookup } from 'node:dns/promises'
import { importWebsiteContent, normalizeKnowledgeImportUrl } from '@/lib/knowledge-import'

const mockedLookup = vi.mocked(lookup)
const publicLookupResult = [{ address: '93.184.216.34', family: 4 }] as unknown as Awaited<
  ReturnType<typeof lookup>
>
const privateLookupResult = [{ address: '10.0.0.5', family: 4 }] as unknown as Awaited<
  ReturnType<typeof lookup>
>

describe('knowledge import safety', () => {
  beforeEach(() => {
    mockedLookup.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects blocked metadata hostnames during normalization', () => {
    expect(() => normalizeKnowledgeImportUrl('https://metadata.google.internal/latest')).toThrow(
      'Private or local network URLs are not allowed.',
    )
  })

  it('blocks redirects into private IP addresses', async () => {
    mockedLookup.mockResolvedValue(publicLookupResult)
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: 'http://127.0.0.1/admin',
        },
      }),
    )

    await expect(importWebsiteContent('https://example.com')).rejects.toThrow(
      'Private or local network URLs are not allowed.',
    )
  })

  it('blocks hostnames that resolve to private network addresses', async () => {
    mockedLookup.mockResolvedValue(privateLookupResult)

    await expect(importWebsiteContent('https://clinic.example')).rejects.toThrow(
      'Private or local network URLs are not allowed.',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
