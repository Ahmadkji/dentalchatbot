import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth()
  if (authError) return authError
  try {
    const { id } = await params
    const existing = await db.unansweredQuestion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.status !== undefined) data.status = body.status
    if (body.answer !== undefined) data.answer = String(body.answer || '').trim() || null

    const updated = await db.unansweredQuestion.update({
      where: { id },
      data,
    })

    if (body.addToFaq === true && updated.answer) {
      const latestFaq = await db.fAQ.findFirst({ orderBy: { order: 'desc' } })
      await db.fAQ.create({
        data: {
          question: updated.question,
          answer: updated.answer,
          order: (latestFaq?.order || 0) + 1,
          isActive: true,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating unanswered question:', error)
    return NextResponse.json({ error: 'Failed to update unanswered question' }, { status: 500 })
  }
}
