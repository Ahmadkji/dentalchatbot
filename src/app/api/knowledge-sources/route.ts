import { createKnowledgeSource, clinicData, getDefaultClinic } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { clinicId: clinic.id }
    if (type) where.type = type
    if (status) where.status = status

    const sources = await clinicData.knowledgeSource.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(sources)
  } catch (error) {
    console.error('Error fetching knowledge sources:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge sources' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, content, type } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    const refreshed = await createKnowledgeSource({
      clinicId: clinic.id,
      title: title.trim(),
      type: type || 'manual_text',
      content: content.trim(),
    })

    return NextResponse.json(refreshed, { status: 201 })
  } catch (error) {
    console.error('Error creating knowledge source:', error)
    return NextResponse.json({ error: 'Failed to create knowledge source' }, { status: 500 })
  }
}
