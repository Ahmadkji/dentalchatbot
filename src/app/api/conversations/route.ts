import { db } from '@/lib/db';
import type { Conversation } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    let conversations = await db.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    // Handle search filter manually (contains + nested patient.name)
    if (search) {
      const searchLower = search.toLowerCase();
      const filtered: Conversation[] = [];
      for (const conv of conversations) {
        const patient = await db.patient.findUnique({ where: { id: conv.patientId } });
        const patientName = patient?.name?.toLowerCase() ?? '';
        const subject = (conv.subject ?? '').toLowerCase();
        const channel = conv.channel.toLowerCase();
        if (patientName.includes(searchLower) || subject.includes(searchLower) || channel.includes(searchLower)) {
          filtered.push(conv);
        }
      }
      conversations = filtered;
    }

    const events = await db.interactionEvent.findMany()
    const eventCountsByConversation = events.reduce<Record<string, { whatsapp: number; location: number; directions: number; call: number }>>((acc, event) => {
      if (!event.conversationId) return acc
      if (!acc[event.conversationId]) {
        acc[event.conversationId] = { whatsapp: 0, location: 0, directions: 0, call: 0 }
      }
      if (event.eventType === 'whatsapp_click') acc[event.conversationId].whatsapp += 1
      if (event.eventType === 'location_click') acc[event.conversationId].location += 1
      if (event.eventType === 'directions_click') acc[event.conversationId].directions += 1
      if (event.eventType === 'call_click') acc[event.conversationId].call += 1
      return acc
    }, {})

    // Flatten patient data for frontend
    const flattened = await Promise.all(conversations.map(async (conv) => {
      const patient = await db.patient.findUnique({ where: { id: conv.patientId } });
      const counts = eventCountsByConversation[conv.id] || { whatsapp: 0, location: 0, directions: 0, call: 0 }
      return {
        id: conv.id,
        patientId: conv.patientId,
        patientName: patient?.name ?? 'Unknown',
        channel: conv.channel,
        status: conv.status,
        subject: conv.subject,
        messageCount: conv.messageCount,
        lastMessage: conv.lastMessage,
        sourcePage: conv.sourcePage,
        helpfulStatus: conv.helpfulStatus,
        needsImprovement: conv.needsImprovement,
        leadCaptured: conv.leadCaptured,
        appointmentRequested: conv.appointmentRequested,
        whatsappClicks: counts.whatsapp,
        locationClicks: counts.location,
        directionsClicks: counts.directions,
        callClicks: counts.call,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    }));

    return NextResponse.json(flattened);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, channel, subject } = body;

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

    const patient = await db.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const conversation = await db.conversation.create({
      data: {
        patientId,
        channel: channel || 'web',
        subject: subject || null,
        status: 'active',
        sourcePage: '/',
        helpfulStatus: 'unreviewed',
        needsImprovement: false,
        leadCaptured: false,
        appointmentRequested: false,
      },
    });

    const convPatient = await db.patient.findUnique({ where: { id: conversation.patientId } });

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
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
