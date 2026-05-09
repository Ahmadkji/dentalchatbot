import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { question, answer, order, isActive } = body;

    const existing = await db.fAQ.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (question !== undefined) data.question = question;
    if (answer !== undefined) data.answer = answer;
    if (order !== undefined) data.order = order;
    if (isActive !== undefined) data.isActive = isActive;

    const faq = await db.fAQ.update({
      where: { id },
      data,
    });

    return NextResponse.json(faq);
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to update FAQ' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.fAQ.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    await db.fAQ.delete({ where: { id } });

    return NextResponse.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}
