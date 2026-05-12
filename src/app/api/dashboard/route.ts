import { db } from '@/lib/db';
import { clinicData, getDefaultClinic } from '@/lib/clinic-data';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function todayLocalPrefix() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const clinic = await getDefaultClinic();
    const clinicId = clinic?.id || null;

    const [
      totalConversations,
      openConversations,
      escalatedConversations,
      resolvedConversations,
      capturedConversations,
      helpfulConversations,
      notHelpfulConversations,
      totalLeads,
      newLeads,
      contactedLeads,
      bookedLeads,
      sourceCount,
      trainedSourceCount,
      staleSourceCount,
      totalKnowledgeChunks,
      unansweredCount,
    ] = await Promise.all([
      db.conversation.count(),
      db.conversation.count({ where: { status: 'active' } }),
      db.conversation.count({ where: { status: 'pending' } }),
      db.conversation.count({ where: { status: 'closed' } }),
      db.conversation.count({ where: { leadCaptured: true } }),
      db.conversation.count({ where: { helpfulStatus: 'helpful' } }),
      db.conversation.count({ where: { helpfulStatus: 'not_helpful' } }),
      db.lead.count(),
      db.lead.count({ where: { status: 'new' } }),
      db.lead.count({ where: { status: 'contacted' } }),
      db.lead.count({ where: { status: 'booked' } }),
      clinicId ? clinicData.knowledgeSource.findMany({ where: { clinicId } }).then((rows) => rows.length) : Promise.resolve(0),
      clinicId ? clinicData.knowledgeSource.findMany({ where: { clinicId, status: 'trained' } }).then((rows) => rows.length) : Promise.resolve(0),
      clinicId ? clinicData.knowledgeSource.findMany({ where: { clinicId, status: 'needs_refresh' } }).then((rows) => rows.length) : Promise.resolve(0),
      clinicId ? clinicData.knowledgeChunk.findMany({ where: { clinicId } }).then((rows) => rows.length) : Promise.resolve(0),
      db.unansweredQuestion.count({ where: { status: 'open' } }),
    ]);

    const leadCaptureRate = totalConversations > 0 ? roundOne((capturedConversations / totalConversations) * 100) : 0;
    const reviewedCount = helpfulConversations + notHelpfulConversations;
    const helpfulRate = reviewedCount > 0 ? roundOne((helpfulConversations / reviewedCount) * 100) : 0;
    const resolutionRate = totalConversations > 0 ? roundOne((resolvedConversations / totalConversations) * 100) : 0;
    const afterHoursLeadCount = (await db.lead.findMany()).filter((lead) => {
      const hour = lead.createdAt.getHours();
      return hour < 9 || hour >= 18;
    }).length;

    const [recentConversations, recentLeads, sourceHealthRows, interactionEvents, unansweredRows] = await Promise.all([
      db.conversation.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      db.lead.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      clinicId
        ? clinicData.knowledgeSource.findMany({
            where: { clinicId },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      db.interactionEvent.findMany({ orderBy: { createdAt: 'desc' } }),
      db.unansweredQuestion.findMany({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const today = todayLocalPrefix();
    const todayEvents = interactionEvents.filter((event) => event.createdAt.toISOString().startsWith(today));
    const whatsappClicks = todayEvents.filter((event) => event.eventType === 'whatsapp_click').length;
    const callClicks = todayEvents.filter((event) => event.eventType === 'call_click').length;
    const locationClicks = todayEvents.filter((event) => event.eventType === 'location_click').length;
    const directionsClicks = todayEvents.filter((event) => event.eventType === 'directions_click').length;
    const appointmentEventCount = todayEvents.filter((event) => event.eventType === 'appointment_request').length;

    const leads = await db.lead.findMany();
    const topServicesAsked = Object.entries(
      leads.reduce<Record<string, number>>((acc, lead) => {
        const key = (lead.service || 'General consultation').trim();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    const flattenedConversations = await Promise.all(
      recentConversations.map(async (conversation) => {
        const patient = await db.patient.findUnique({ where: { id: conversation.patientId } });
        return {
          id: conversation.id,
          visitorName: patient?.name || 'Website Visitor',
          status: conversation.status,
          messageCount: conversation.messageCount,
          leadCaptured: conversation.leadCaptured,
          helpfulStatus: conversation.helpfulStatus,
          sourcePage: conversation.sourcePage,
          updatedAt: conversation.updatedAt,
        };
      })
    );

    const flattenedLeads = recentLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      preferredContact: lead.preferredContact,
      source: lead.source,
      createdAt: lead.createdAt,
    }));

    const sourceHealth = sourceHealthRows.slice(0, 8).map((source) => ({
      id: source.id,
      title: source.title,
      type: source.type,
      status: source.status,
      chunkCount: source.chunkCount,
      updatedAt: source.updatedAt,
      lastSyncedAt: source.lastSyncedAt,
    }));

    const unansweredPreview = unansweredRows.slice(0, 6).map((row) => ({
      id: row.id,
      question: row.question,
      sourcePage: row.sourcePage,
      createdAt: row.createdAt,
      status: row.status,
    }));

    return NextResponse.json({
      stats: {
        totalConversations,
        openConversations,
        escalatedConversations,
        resolvedConversations,
        resolutionRate,
        totalLeads,
        newLeads,
        contactedLeads,
        bookedLeads,
        leadCaptureRate,
        helpfulRate,
        sourceCount,
        trainedSourceCount,
        staleSourceCount,
        totalKnowledgeChunks,
        unansweredCount,
        whatsappClicks,
        callClicks,
        locationClicks,
        directionsClicks,
        appointmentEventCount,
        afterHoursLeadCount,
      },
      recentConversations: flattenedConversations,
      recentLeads: flattenedLeads,
      sourceHealth,
      unansweredPreview,
      topServicesAsked,
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard analytics' },
      { status: 500 }
    );
  }
}
