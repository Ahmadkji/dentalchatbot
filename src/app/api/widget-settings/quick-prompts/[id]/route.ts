import { clinicData } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await clinicData.quickPrompt.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Quick prompt not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.label !== undefined) data.label = String(body.label).trim()
    if (body.message !== undefined) data.message = String(body.message).trim()
    if (body.actionType !== undefined) data.actionType = body.actionType
    if (body.actionValue !== undefined) data.actionValue = body.actionValue || null
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 99
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const updated = await clinicData.quickPrompt.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating quick prompt:', error)
    return NextResponse.json({ error: 'Failed to update quick prompt' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await clinicData.quickPrompt.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Quick prompt not found' }, { status: 404 })
    }

    await clinicData.quickPrompt.delete({ where: { id } })
    return NextResponse.json({ message: 'Quick prompt deleted successfully' })
  } catch (error) {
    console.error('Error deleting quick prompt:', error)
    return NextResponse.json({ error: 'Failed to delete quick prompt' }, { status: 500 })
  }
}
