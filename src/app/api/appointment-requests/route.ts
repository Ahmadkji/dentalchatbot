import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const appointmentRequests = await db.appointmentRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(appointmentRequests);
  } catch (error) {
    console.error('Error fetching appointment requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointment requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, preferredDate, preferredTime, reason, preferredDoctor, source } = body;

    if (!name || !phone || !preferredDate || !preferredTime) {
      return NextResponse.json(
        { error: 'name, phone, preferredDate, and preferredTime are required' },
        { status: 400 }
      );
    }

    const appointmentRequest = await db.appointmentRequest.create({
      data: {
        name,
        phone,
        preferredDate,
        preferredTime,
        reason: reason || '',
        preferredDoctor: preferredDoctor || null,
        source: source || 'chatbot',
      },
    });

    return NextResponse.json(appointmentRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating appointment request:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment request' },
      { status: 500 }
    );
  }
}
