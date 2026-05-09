import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Return flattened conversation with messages
    return NextResponse.json({
      id: conversation.id,
      patientId: conversation.patientId,
      patientName: conversation.patient.name,
      channel: conversation.channel,
      status: conversation.status,
      subject: conversation.subject,
      messageCount: conversation.messageCount,
      lastMessage: conversation.lastMessage,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    const existing = await db.conversation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const conversation = await db.conversation.update({
      where: { id },
      data: { status },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    // Return flattened response consistent with list endpoint
    return NextResponse.json({
      id: conversation.id,
      patientId: conversation.patientId,
      patientName: conversation.patient.name,
      channel: conversation.channel,
      status: conversation.status,
      subject: conversation.subject,
      messageCount: conversation.messageCount,
      lastMessage: conversation.lastMessage,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
