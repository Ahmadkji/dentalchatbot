import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      duration,
      requiresAppointment,
      preparationInstructions,
      price,
      department,
      isActive,
    } = body;

    const existing = await db.service.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (duration !== undefined) data.duration = duration;
    if (requiresAppointment !== undefined) data.requiresAppointment = requiresAppointment;
    if (preparationInstructions !== undefined) data.preparationInstructions = preparationInstructions;
    if (price !== undefined) data.price = price;
    if (department !== undefined) data.department = department;
    if (isActive !== undefined) data.isActive = isActive;

    const service = await db.service.update({
      where: { id },
      data,
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
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

    const existing = await db.service.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    const service = await db.service.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}
