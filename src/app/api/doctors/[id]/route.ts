import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, specialization, phone, availableDays, isActive } = body;

    const existing = await db.doctor.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (specialization !== undefined) data.specialization = specialization;
    if (phone !== undefined) data.phone = phone;
    if (availableDays !== undefined) data.availableDays = availableDays;
    if (isActive !== undefined) data.isActive = isActive;

    const doctor = await db.doctor.update({
      where: { id },
      data,
    });

    return NextResponse.json(doctor);
  } catch (error) {
    console.error('Error updating doctor:', error);
    return NextResponse.json(
      { error: 'Failed to update doctor' },
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

    const existing = await db.doctor.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    const doctor = await db.doctor.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(doctor);
  } catch (error) {
    console.error('Error deleting doctor:', error);
    return NextResponse.json(
      { error: 'Failed to delete doctor' },
      { status: 500 }
    );
  }
}
