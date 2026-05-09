import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active');

    const where: Record<string, unknown> = {};
    if (activeOnly === 'true') where.isActive = true;

    const doctors = await db.doctor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch doctors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, specialization, phone, availableDays, isActive } = body;

    if (!name || !specialization) {
      return NextResponse.json(
        { error: 'name and specialization are required' },
        { status: 400 }
      );
    }

    const doctor = await db.doctor.create({
      data: {
        name,
        specialization,
        phone: phone || '',
        availableDays: availableDays || 'Mon-Fri',
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(doctor, { status: 201 });
  } catch (error) {
    console.error('Error creating doctor:', error);
    return NextResponse.json(
      { error: 'Failed to create doctor' },
      { status: 500 }
    );
  }
}
