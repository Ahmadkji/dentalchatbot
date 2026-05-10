import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    let where: Record<string, unknown> = {};
    if (search) {
      // For mock store, get all and filter manually for contains
      const all = await db.patient.findMany();
      const filtered = all.filter((p) =>
        p.name.includes(search) || p.email.includes(search) || p.phone.includes(search)
      );
      const formatted = filtered.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        dateOfBirth: p.dob,
        lastVisit: p.lastVisit,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      return NextResponse.json(formatted);
    }

    const patients = await db.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Format for frontend - map dob to dateOfBirth
    const formatted = patients.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      dateOfBirth: p.dob,
      lastVisit: p.lastVisit,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, dateOfBirth, dob, lastVisit, status } = body;

    const resolvedDob = dob || dateOfBirth;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const patient = await db.patient.create({
      data: {
        name,
        email: email || '',
        phone: phone || '',
        dob: resolvedDob || '',
        lastVisit: lastVisit || null,
        status: status || 'active',
      },
    });

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
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    );
  }
}
