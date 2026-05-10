import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await db.unansweredQuestion.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching unanswered questions:', error)
    return NextResponse.json({ error: 'Failed to fetch unanswered questions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const question = String(body.question || '').trim()
    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const created = await db.unansweredQuestion.create({
      data: {
        conversationId: body.conversationId ? String(body.conversationId) : null,
        question,
        sourcePage: body.sourcePage ? String(body.sourcePage) : null,
        status: 'open',
        answer: null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating unanswered question:', error)
    return NextResponse.json({ error: 'Failed to create unanswered question' }, { status: 500 })
  }
}
