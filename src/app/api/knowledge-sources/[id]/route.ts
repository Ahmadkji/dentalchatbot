import { clinicData, rebuildKnowledgeSourceChunks } from '@/lib/clinic-data'
import { importWebsiteContent } from '@/lib/knowledge-import'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await clinicData.knowledgeSource.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.content !== undefined) data.content = String(body.content).trim()
    if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl || null
    if (body.status !== undefined) data.status = body.status

    if (body.refresh === true && existing.type === 'website' && existing.sourceUrl) {
      const imported = await importWebsiteContent(existing.sourceUrl)
      await clinicData.knowledgeSource.update({
        where: { id },
        data: {
          title: imported.title,
          content: imported.content,
          status: 'processing',
          errorMessage: null,
        },
      })
      await rebuildKnowledgeSourceChunks(id)
    } else {
      await clinicData.knowledgeSource.update({
        where: { id },
        data: {
          ...data,
          status: body.content !== undefined ? 'processing' : data.status,
        },
      })

      if (body.content !== undefined || body.retrain === true) {
        await rebuildKnowledgeSourceChunks(id)
      }
    }

    const updated = await clinicData.knowledgeSource.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating knowledge source:', error)
    return NextResponse.json({ error: 'Failed to update knowledge source' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await clinicData.knowledgeSource.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    const chunks = await clinicData.knowledgeChunk.findMany({ where: { sourceId: id } })
    await Promise.all(chunks.map((chunk) => clinicData.knowledgeChunk.delete({ where: { id: chunk.id } })))
    await clinicData.knowledgeSource.delete({ where: { id } })

    return NextResponse.json({ message: 'Knowledge source deleted successfully' })
  } catch (error) {
    console.error('Error deleting knowledge source:', error)
    return NextResponse.json({ error: 'Failed to delete knowledge source' }, { status: 500 })
  }
}
