import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Get today's date in local timezone (not UTC)
function getTodayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const dateParam = searchParams.get('date');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (dateParam === 'today') {
      where.date = getTodayLocal();
    } else if (dateParam) {
      where.date = dateParam;
    }

    const appointments = await db.appointment.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    // Flatten patient data for frontend
    const flattened = await Promise.all(appointments.map(async (appt) => {
      const patient = await db.patient.findUnique({ where: { id: appt.patientId } });
      return {
        id: appt.id,
        patientId: appt.patientId,
        patientName: patient?.name ?? 'Unknown',
        date: appt.date,
        time: appt.time,
        duration: appt.duration,
        type: appt.type,
        status: appt.status,
        notes: appt.notes,
        createdAt: appt.createdAt,
        updatedAt: appt.updatedAt,
      };
    }));

    return NextResponse.json(flattened);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, patientName, date, time, duration, type, status, notes } = body;

    // Find or create patient by name if patientId not provided
    let resolvedPatientId = patientId;

    if (!resolvedPatientId && patientName) {
      // Try to find existing patient by name
      const allPatients = await db.patient.findMany();
      const existingPatient = allPatients.find((p) => p.name.includes(patientName));
      if (existingPatient) {
        resolvedPatientId = existingPatient.id;
      } else {
        // Create a new patient
        const newPatient = await db.patient.create({
          data: {
            name: patientName,
            email: `${patientName.toLowerCase().replace(/\s+/g, '.')}@guest.com`,
            phone: '',
            dob: '',
            status: 'active',
          },
        });
        resolvedPatientId = newPatient.id;
      }
    }

    if (!resolvedPatientId || !date || !time || !type) {
      return NextResponse.json(
        { error: 'patientId (or patientName), date, time, and type are required' },
        { status: 400 }
      );
    }

    const appointment = await db.appointment.create({
      data: {
        patientId: resolvedPatientId,
        date,
        time,
        duration: duration || 30,
        type,
        status: status || 'scheduled',
        notes: notes || null,
      },
    });

    const aptPatient = await db.patient.findUnique({ where: { id: appointment.patientId } });

    return NextResponse.json({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: aptPatient?.name ?? 'Unknown',
      date: appointment.date,
      time: appointment.time,
      duration: appointment.duration,
      type: appointment.type,
      status: appointment.status,
      notes: appointment.notes,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    );
  }
}
