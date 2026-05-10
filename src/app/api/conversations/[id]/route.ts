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
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const convMessages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    const events = await db.interactionEvent.findMany({ where: { conversationId: id } })
    const counts = events.reduce(
      (acc, event) => {
        if (event.eventType === 'whatsapp_click') acc.whatsapp += 1
        if (event.eventType === 'location_click') acc.location += 1
        if (event.eventType === 'directions_click') acc.directions += 1
        if (event.eventType === 'call_click') acc.call += 1
        return acc
      },
      { whatsapp: 0, location: 0, directions: 0, call: 0 }
    )

    const convPatient = await db.patient.findUnique({ where: { id: conversation.patientId } });

    // Return flattened conversation with messages
    return NextResponse.json({
      id: conversation.id,
      patientId: conversation.patientId,
      patientName: convPatient?.name ?? 'Unknown',
      channel: conversation.channel,
      status: conversation.status,
      subject: conversation.subject,
      messageCount: conversation.messageCount,
      lastMessage: conversation.lastMessage,
      sourcePage: conversation.sourcePage,
      helpfulStatus: conversation.helpfulStatus,
      needsImprovement: conversation.needsImprovement,
      leadCaptured: conversation.leadCaptured,
      appointmentRequested: conversation.appointmentRequested,
      whatsappClicks: counts.whatsapp,
      locationClicks: counts.location,
      directionsClicks: counts.directions,
      callClicks: counts.call,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: convMessages,
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
    const { status, helpfulStatus, needsImprovement, leadCaptured, appointmentRequested, sourcePage } = body;

    if (
      status === undefined &&
      helpfulStatus === undefined &&
      needsImprovement === undefined &&
      leadCaptured === undefined &&
      appointmentRequested === undefined &&
      sourcePage === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one update field is required' },
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
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(helpfulStatus !== undefined ? { helpfulStatus } : {}),
        ...(needsImprovement !== undefined ? { needsImprovement } : {}),
        ...(leadCaptured !== undefined ? { leadCaptured } : {}),
        ...(appointmentRequested !== undefined ? { appointmentRequested } : {}),
        ...(sourcePage !== undefined ? { sourcePage } : {}),
      },
    });

    const convPatient = await db.patient.findUnique({ where: { id: conversation.patientId } });
    const events = await db.interactionEvent.findMany({ where: { conversationId: id } })
    const counts = events.reduce(
      (acc, event) => {
        if (event.eventType === 'whatsapp_click') acc.whatsapp += 1
        if (event.eventType === 'location_click') acc.location += 1
        if (event.eventType === 'directions_click') acc.directions += 1
        if (event.eventType === 'call_click') acc.call += 1
        return acc
      },
      { whatsapp: 0, location: 0, directions: 0, call: 0 }
    )

    // Return flattened response consistent with list endpoint
    return NextResponse.json({
      id: conversation.id,
      patientId: conversation.patientId,
      patientName: convPatient?.name ?? 'Unknown',
      channel: conversation.channel,
      status: conversation.status,
      subject: conversation.subject,
      messageCount: conversation.messageCount,
      lastMessage: conversation.lastMessage,
      sourcePage: conversation.sourcePage,
      helpfulStatus: conversation.helpfulStatus,
      needsImprovement: conversation.needsImprovement,
      leadCaptured: conversation.leadCaptured,
      appointmentRequested: conversation.appointmentRequested,
      whatsappClicks: counts.whatsapp,
      locationClicks: counts.location,
      directionsClicks: counts.directions,
      callClicks: counts.call,
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
