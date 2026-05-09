import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Get today's date in local timezone (not UTC)
function getTodayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET() {
  try {
    const today = getTodayLocal();

    const [
      totalPatients,
      activeConversations,
      todayAppointments,
      completedToday,
      pendingLeads,
      pendingAppointmentRequests,
      activeServices,
      activeDoctors,
    ] = await Promise.all([
      db.patient.count(),
      db.conversation.count({ where: { status: 'active' } }),
      db.appointment.count({ where: { date: today } }),
      db.appointment.count({ where: { date: today, status: 'completed' } }),
      db.lead.count({ where: { status: 'new' } }),
      db.appointmentRequest.count({ where: { status: 'pending' } }),
      db.service.count({ where: { isActive: true } }),
      db.doctor.count({ where: { isActive: true } }),
    ]);

    // Get recent conversations with flattened patient data
    const recentConversations = await db.conversation.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    const flattenedConversations = recentConversations.map((conv) => ({
      id: conv.id,
      patientId: conv.patientId,
      patientName: conv.patient.name,
      channel: conv.channel,
      status: conv.status,
      subject: conv.subject,
      messageCount: conv.messageCount,
      lastMessage: conv.lastMessage,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    // Get today's appointments with flattened patient data
    const todayAppointmentsList = await db.appointment.findMany({
      where: { date: today },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { time: 'asc' },
    });

    const flattenedAppointments = todayAppointmentsList.map((appt) => ({
      id: appt.id,
      patientId: appt.patientId,
      patientName: appt.patient.name,
      date: appt.date,
      time: appt.time,
      duration: appt.duration,
      type: appt.type,
      status: appt.status,
      notes: appt.notes,
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt,
    }));

    return NextResponse.json({
      stats: {
        totalPatients,
        activeConversations,
        todayAppointments,
        completedToday,
        pendingLeads,
        pendingAppointmentRequests,
        activeServices,
        activeDoctors,
      },
      recentConversations: flattenedConversations,
      todayAppointments: flattenedAppointments,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
