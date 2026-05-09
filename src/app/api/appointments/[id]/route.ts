import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, date, time, duration, type } = body;

    const existing = await db.appointment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (date !== undefined) data.date = date;
    if (time !== undefined) data.time = time;
    if (duration !== undefined) data.duration = duration;
    if (type !== undefined) data.type = type;

    const appointment = await db.appointment.update({
      where: { id },
      data,
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

    // Return flattened response consistent with GET/POST
    return NextResponse.json({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patient.name,
      date: appointment.date,
      time: appointment.time,
      duration: appointment.duration,
      type: appointment.type,
      status: appointment.status,
      notes: appointment.notes,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    );
  }
}
