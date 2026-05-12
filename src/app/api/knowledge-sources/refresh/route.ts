import { clinicData, getDefaultClinic, rebuildKnowledgeSourceChunks } from '@/lib/clinic-data'
import { importWebsiteContent } from '@/lib/knowledge-import'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'

export async function POST() {
  const { error: authError } = await requireAuth()
  if (authError) return authError
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const sources = await clinicData.knowledgeSource.findMany({
      where: { clinicId: clinic.id },
      orderBy: { updatedAt: 'desc' },
    })

    let refreshed = 0
    for (const source of sources) {
      try {
        if (source.type === 'website' && source.sourceUrl) {
          const imported = await importWebsiteContent(source.sourceUrl)
          await clinicData.knowledgeSource.update({
            where: { id: source.id },
            data: {
              title: imported.title,
              content: imported.content,
              status: 'processing',
              errorMessage: null,
            },
          })
          await rebuildKnowledgeSourceChunks(source.id)
          refreshed += 1
          continue
        }

        await clinicData.knowledgeSource.update({
          where: { id: source.id },
          data: { status: 'processing', errorMessage: null },
        })
        await rebuildKnowledgeSourceChunks(source.id)
        refreshed += 1
      } catch {
        await clinicData.knowledgeSource.update({
          where: { id: source.id },
          data: { status: 'failed', errorMessage: 'Refresh failed for this source.' },
        })
      }
    }

    return NextResponse.json({
      refreshed,
      total: sources.length,
      message: 'Knowledge refresh finished',
    })
  } catch (error) {
    console.error('Error refreshing knowledge sources:', error)
    return NextResponse.json({ error: 'Failed to refresh knowledge sources' }, { status: 500 })
  }
}
