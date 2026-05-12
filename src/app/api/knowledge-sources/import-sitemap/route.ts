import { createKnowledgeSource, clinicData, getDefaultClinic, rebuildKnowledgeSourceChunks } from '@/lib/clinic-data'
import { importSitemapContent } from '@/lib/knowledge-import'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'

const MAX_SITEMAP_PAGES = 20

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const body = await request.json()
    const sitemapUrl = String(body.sitemapUrl || '').trim()
    if (!sitemapUrl) {
      return NextResponse.json({ error: 'sitemapUrl is required' }, { status: 400 })
    }

    const imported = await importSitemapContent(sitemapUrl, MAX_SITEMAP_PAGES)
    const importedSources = []

    for (const page of imported.pages) {
      const duplicate = await clinicData.knowledgeSource.findFirst({
        where: { clinicId: clinic.id, type: 'website', sourceUrl: page.url },
      })

      if (duplicate) {
        await clinicData.knowledgeSource.update({
          where: { id: duplicate.id },
          data: {
            title: page.title,
            content: page.content,
            status: 'processing',
            errorMessage: null,
          },
        })
        await rebuildKnowledgeSourceChunks(duplicate.id)
        importedSources.push(await clinicData.knowledgeSource.findUnique({ where: { id: duplicate.id } }))
      } else {
        const created = await createKnowledgeSource({
          clinicId: clinic.id,
          title: page.title,
          type: 'website',
          content: page.content,
          sourceUrl: page.url,
        })
        importedSources.push(created)
      }
    }

    return NextResponse.json({
      sitemapUrl: imported.sitemapUrl,
      importedCount: importedSources.length,
      maxPages: MAX_SITEMAP_PAGES,
      sources: importedSources,
    })
  } catch (error) {
    console.error('Error importing sitemap:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import sitemap' },
      { status: 500 }
    )
  }
}
