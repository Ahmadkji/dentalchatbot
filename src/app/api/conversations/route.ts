import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { patient: { name: { contains: search } } },
        { subject: { contains: search } },
        { channel: { contains: search } },
      ];
    }

    const conversations = await db.conversation.findMany({
      where,
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
      orderBy: { updatedAt: 'desc' },
    });

    // Flatten patient data for frontend
    const flattened = conversations.map((conv) => ({
      id: conv.id,
      patientId: conv.patientId,
      patientName: conv.patient.name,
      channel: conv.channel,
      status: conv.status,
      subject: conv.subject,
      messageCount: conv.messageCount,
      lastMessage: conv.lastMessage,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
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
      },
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
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
