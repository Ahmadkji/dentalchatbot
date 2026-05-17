import { beforeEach, describe, expect, it, vi } from 'vitest'

const embedTexts384Mock = vi.fn()
const adminRpcMock = vi.fn()

vi.mock('@/lib/knowledge/embeddings', () => ({
  embedTexts384: embedTexts384Mock,
  embedText384: vi.fn(),
  serializePgVector: (vector: number[]) => `[${vector.join(',')}]`,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    rpc: adminRpcMock,
  }),
}))

describe('syncKnowledgeSourceContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    embedTexts384Mock.mockResolvedValue({
      model: 'gte-small',
      dimension: 384,
      vectors: [new Array(384).fill(0.1)],
    })
  })

  it('uses the admin client for embedding updates after chunk replacement', async () => {
    const sourceRpcMock = vi.fn().mockResolvedValue({ error: null })

    const { syncKnowledgeSourceContent } = await import('@/lib/knowledge/sources')

    await syncKnowledgeSourceContent(
      {
        from: vi.fn(),
        rpc: sourceRpcMock,
      },
      {
        sourceId: 'source-1',
        title: 'FAQ entry',
        content: 'This is a long enough FAQ entry to produce a searchable chunk with useful content.',
        sourceType: 'faq',
        pageTitle: 'FAQ entry',
        sectionHeading: 'FAQ',
      },
    )

    expect(sourceRpcMock).toHaveBeenCalledWith(
      'replace_knowledge_source_chunks',
      expect.any(Object),
    )
    expect(adminRpcMock).toHaveBeenCalledWith(
      'update_knowledge_chunk_embeddings_384',
      expect.objectContaining({
        p_source_id: 'source-1',
        p_embedding_model: 'gte-small',
      }),
    )
  })
})
