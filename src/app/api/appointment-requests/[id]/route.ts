import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, name, phone, preferredDate, preferredTime, reason, preferredDoctor } = body;

    const existing = await db.appointmentRequest.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Appointment request not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (preferredDate !== undefined) data.preferredDate = preferredDate;
    if (preferredTime !== undefined) data.preferredTime = preferredTime;
    if (reason !== undefined) data.reason = reason;
    if (preferredDoctor !== undefined) data.preferredDoctor = preferredDoctor;

    const appointmentRequest = await db.appointmentRequest.update({
      where: { id },
      data,
    });

    return NextResponse.json(appointmentRequest);
  } catch (error) {
    console.error('Error updating appointment request:', error);
    return NextResponse.json(
      { error: 'Failed to update appointment request' },
      { status: 500 }
    );
  }
}
