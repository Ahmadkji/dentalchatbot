import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const allowedTypes = new Set([
  'whatsapp_click',
  'call_click',
  'location_click',
  'directions_click',
  'appointment_request',
])

const allowedSources = new Set(['playground', 'widget'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eventType = String(body.eventType || '')
    const source = String(body.source || '')

    if (!allowedTypes.has(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
    }

    if (!allowedSources.has(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    }

    const created = await db.interactionEvent.create({
      data: {
        conversationId: body.conversationId ? String(body.conversationId) : null,
        eventType: eventType as 'whatsapp_click' | 'call_click' | 'location_click' | 'directions_click' | 'appointment_request',
        source: source as 'playground' | 'widget',
        service: body.service ? String(body.service) : null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error logging analytics event:', error)
    return NextResponse.json({ error: 'Failed to log analytics event' }, { status: 500 })
  }
}
