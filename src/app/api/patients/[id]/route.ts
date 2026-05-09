import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, name, email, phone, dateOfBirth, dob, lastVisit } = body;

    const existing = await db.patient.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (dateOfBirth !== undefined) data.dob = dateOfBirth;
    if (dob !== undefined) data.dob = dob;
    if (lastVisit !== undefined) data.lastVisit = lastVisit;

    const patient = await db.patient.update({
      where: { id },
      data,
    });

    // Return flattened response like GET/POST endpoints
    return NextResponse.json({
      id: patient.id,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      dateOfBirth: patient.dob,
      lastVisit: patient.lastVisit,
      status: patient.status,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json(
      { error: 'Failed to update patient' },
      { status: 500 }
    );
  }
}
