import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const department = searchParams.get('department');
    const activeOnly = searchParams.get('active');

    const where: Record<string, unknown> = {};
    if (department) where.department = department;
    if (activeOnly === 'true') where.isActive = true;

    const services = await db.service.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 }
      );
    }

    const service = await db.service.create({
      data: {
        name,
        description,
        duration: duration || '30 min',
        requiresAppointment: requiresAppointment !== undefined ? requiresAppointment : true,
        preparationInstructions: preparationInstructions || null,
        price: price || null,
        department: department || 'dental',
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}
