import { createKnowledgeSource, clinicData, getDefaultClinic, rebuildKnowledgeSourceChunks } from '@/lib/clinic-data'
import { importWebsiteContent } from '@/lib/knowledge-import'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const body = await request.json()
    const { url } = body

    if (!url?.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const imported = await importWebsiteContent(url.trim())

    const duplicate = await clinicData.knowledgeSource.findFirst({
      where: { clinicId: clinic.id, type: 'website', sourceUrl: imported.url },
    })

    if (duplicate) {
      await clinicData.knowledgeSource.update({
        where: { id: duplicate.id },
        data: {
          title: imported.title,
          content: imported.content,
          status: 'processing',
          errorMessage: null,
        },
      })
      await rebuildKnowledgeSourceChunks(duplicate.id)
      const updated = await clinicData.knowledgeSource.findUnique({ where: { id: duplicate.id } })

      return NextResponse.json(updated)
    }

    const source = await createKnowledgeSource({
      clinicId: clinic.id,
      title: imported.title,
      type: 'website',
      content: imported.content,
      sourceUrl: imported.url,
    })

    return NextResponse.json(source, { status: 201 })
  } catch (error) {
    console.error('Error importing website:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to import website' }, { status: 500 })
  }
}
