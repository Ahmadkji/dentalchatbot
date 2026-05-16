import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    let query = supabase
      .from('leads')
      .select('*')
      .eq('clinic_id', current.clinic.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: leads, error } = await query

    if (error) throw error

    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const body = await request.json()
    const { name, phone, question, preferredContact, source, service, preferredDate, preferredTime, message, internalNote, conversationId } = body

    if (!name || !phone) {
      return NextResponse.json({ error: 'name and phone are required' }, { status: 400 })
    }

    const adminClient = createSupabaseAdminClient()
    let resolvedConversationId: string | null = null

    if (conversationId) {
      const { data: conversation } = await adminClient
        .from('conversations')
        .select('id')
        .eq('id', String(conversationId))
        .eq('clinic_id', current.clinic.id)
        .maybeSingle()

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      resolvedConversationId = conversation.id
    }

    const { data: lead, error } = await adminClient
      .from('leads')
      .insert({
        clinic_id: current.clinic.id,
        conversation_id: resolvedConversationId,
        name,
        phone,
        question: question || '',
        service: service || null,
        preferred_date: preferredDate || null,
        preferred_time: preferredTime || null,
        message: message || null,
        internal_note: internalNote || null,
        preferred_contact: preferredContact || 'phone',
        status: 'new',
        source: source || 'chatbot',
      })
      .select('*')
      .single()

    if (error) throw error

    if (resolvedConversationId) {
      await adminClient
        .from('conversations')
        .update({
          lead_captured: true,
          visitor_name: String(name),
        })
        .eq('id', resolvedConversationId)
    }

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
