import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return asUtc - date.getTime()
}

function clinicDateBoundaryToUtc(dateValue: string | null, timeZone: string, addDays = 0): string | null {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null

  const [year, month, day] = dateValue.split('-').map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day + addDays, 0, 0, 0))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  return new Date(utcGuess.getTime() - offset).toISOString()
}

interface SourceHealthRow {
  id: string
  title: string
  source_type: string
  status: string
  chunk_count: number
  updated_at: string | Date
  last_synced_at: string | Date | null
  is_active: boolean
}

interface DashboardKpiRow {
  total_conversations: number | string | null
  open_conversations: number | string | null
  escalated_conversations: number | string | null
  resolved_conversations: number | string | null
  captured_conversations: number | string | null
  helpful_conversations: number | string | null
  not_helpful_conversations: number | string | null
  total_leads: number | string | null
  new_leads: number | string | null
  contacted_leads: number | string | null
  booked_leads: number | string | null
  unanswered_count: number | string | null
  source_count: number | string | null
  trained_source_count: number | string | null
  stale_source_count: number | string | null
  total_knowledge_chunks: number | string | null
  whatsapp_clicks: number | string | null
  call_clicks: number | string | null
  location_clicks: number | string | null
  directions_clicks: number | string | null
  appointment_event_count: number | string | null
  after_hours_lead_count: number | string | null
}

interface DashboardTopServiceRow {
  service_name: string
  mention_count: number | string | null
}

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)

    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const adminClient = createSupabaseAdminClient()
    const clinicId = clinic.id
    const startAt = clinicDateBoundaryToUtc(request.nextUrl.searchParams.get('startDate'), clinic.timezone)
    const endAt = clinicDateBoundaryToUtc(
      request.nextUrl.searchParams.get('endDate') ?? request.nextUrl.searchParams.get('startDate'),
      clinic.timezone,
      1,
    )

    const { data: kpiRow, error: kpiError } = await adminClient
      .rpc('get_dashboard_kpis', {
        p_clinic_id: clinicId,
        p_start_at: startAt,
        p_end_at: endAt,
      })
      .maybeSingle()

    if (kpiError) throw kpiError

    const kpis = (kpiRow ?? {}) as Partial<DashboardKpiRow>
    const totalConversations = Number(kpis.total_conversations ?? 0)
    const openConversations = Number(kpis.open_conversations ?? 0)
    const escalatedConversations = Number(kpis.escalated_conversations ?? 0)
    const resolvedConversations = Number(kpis.resolved_conversations ?? 0)
    const capturedConversations = Number(kpis.captured_conversations ?? 0)
    const helpfulConversations = Number(kpis.helpful_conversations ?? 0)
    const notHelpfulConversations = Number(kpis.not_helpful_conversations ?? 0)
    const totalLeads = Number(kpis.total_leads ?? 0)
    const newLeads = Number(kpis.new_leads ?? 0)
    const contactedLeads = Number(kpis.contacted_leads ?? 0)
    const bookedLeads = Number(kpis.booked_leads ?? 0)
    const unansweredCount = Number(kpis.unanswered_count ?? 0)
    const sourceCount = Number(kpis.source_count ?? 0)
    const trainedSourceCount = Number(kpis.trained_source_count ?? 0)
    const staleSourceCount = Number(kpis.stale_source_count ?? 0)
    const totalKnowledgeChunks = Number(kpis.total_knowledge_chunks ?? 0)
    const whatsappClicks = Number(kpis.whatsapp_clicks ?? 0)
    const callClicks = Number(kpis.call_clicks ?? 0)
    const locationClicks = Number(kpis.location_clicks ?? 0)
    const directionsClicks = Number(kpis.directions_clicks ?? 0)
    const appointmentEventCount = Number(kpis.appointment_event_count ?? 0)
    const afterHoursLeadCount = Number(kpis.after_hours_lead_count ?? 0)

    const leadCaptureRate = totalConversations > 0 ? roundOne((capturedConversations / totalConversations) * 100) : 0
    const reviewedCount = helpfulConversations + notHelpfulConversations
    const helpfulRate = reviewedCount > 0 ? roundOne((helpfulConversations / reviewedCount) * 100) : 0
    const resolutionRate = totalConversations > 0 ? roundOne((resolvedConversations / totalConversations) * 100) : 0

    // Recent data + events
    const [
      recentConversations,
      recentLeads,
      topServicesResult,
      unansweredRows,
      sourceSummaryRows,
      chunkSummary,
      sourceHealthRows,
    ] = await Promise.all([
      adminClient
        .from('conversations')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('updated_at', { ascending: false })
        .limit(8),
      adminClient
        .from('leads')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(8),
      adminClient.rpc('get_dashboard_top_services', {
        p_clinic_id: clinicId,
        p_start_at: startAt,
        p_end_at: endAt,
        p_limit: 5,
      }),
      adminClient
        .from('unanswered_questions')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase
        .from('knowledge_sources')
        .select('id,status,is_active')
        .eq('clinic_id', clinicId)
        .neq('source_type', 'faq'),
      supabase
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('is_active', true),
      supabase
        .from('knowledge_sources')
        .select('id,title,source_type,status,chunk_count,updated_at,last_synced_at,is_active')
        .eq('clinic_id', clinicId)
        .neq('source_type', 'faq')
        .order('updated_at', { ascending: false })
        .limit(8),
    ])

    if (sourceSummaryRows.error) throw sourceSummaryRows.error
    if (chunkSummary.error) throw chunkSummary.error
    if (sourceHealthRows.error) throw sourceHealthRows.error
    if (topServicesResult.error) throw topServicesResult.error

    const topServicesAsked = ((topServicesResult.data ?? []) as DashboardTopServiceRow[]).map((row) => ({
      service: row.service_name,
      count: Number(row.mention_count ?? 0),
    }))

    const flattenedConversations = (recentConversations.data ?? []).map((conv) => ({
      id: conv.id,
      visitorName: conv.visitor_name || 'Website Visitor',
      status: conv.status,
      messageCount: conv.message_count,
      leadCaptured: conv.lead_captured,
      helpfulStatus: conv.helpful_status,
      sourcePage: conv.source_page,
      updatedAt: conv.updated_at,
    }))

    const flattenedLeads = (recentLeads.data ?? []).map((lead) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      preferredContact: lead.preferred_contact,
      source: lead.source,
      createdAt: lead.created_at,
    }))

    const sourceHealth = ((sourceHealthRows.data ?? []) as SourceHealthRow[]).slice(0, 8).map((source) => ({
      id: source.id,
      title: source.title,
      type:
        source.source_type === 'website_url'
          ? 'website'
          : source.source_type === 'file_upload'
            ? 'file'
            : source.source_type,
      status: source.status,
      chunkCount: source.chunk_count,
      updatedAt: source.updated_at,
      lastSyncedAt: source.last_synced_at,
    }))

    const unansweredPreview = (unansweredRows.data ?? []).slice(0, 6).map((row) => ({
      id: row.id,
      question: row.question,
      sourcePage: row.source_page,
      createdAt: row.created_at,
      status: row.status,
    }))

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
    })
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard analytics' }, { status: 500 })
  }
}
