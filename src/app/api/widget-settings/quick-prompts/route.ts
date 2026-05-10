import { clinicData, getDefaultClinic } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const prompts = await clinicData.quickPrompt.findMany({
      where: { clinicId: clinic.id },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(prompts)
  } catch (error) {
    console.error('Error fetching quick prompts:', error)
    return NextResponse.json({ error: 'Failed to fetch quick prompts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const body = await request.json()
    const { label, message, actionType, actionValue, sortOrder, isActive } = body

    if (!label?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'label and message are required' }, { status: 400 })
    }

    const prompt = await clinicData.quickPrompt.create({
      data: {
        clinicId: clinic.id,
        label: label.trim(),
        message: message.trim(),
        actionType: actionType || 'message',
        actionValue: actionValue || null,
        sortOrder: Number(sortOrder) || 99,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    })

    return NextResponse.json(prompt, { status: 201 })
  } catch (error) {
    console.error('Error creating quick prompt:', error)
    return NextResponse.json({ error: 'Failed to create quick prompt' }, { status: 500 })
  }
}
