import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'

export async function GET() {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const current = await getCurrentClinic(supabase, user)
    if (!current.clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const { data: rows, error } = await supabase
      .from('unanswered_questions')
      .select('*')
      .eq('clinic_id', current.clinic.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching unanswered questions:', error)
    return NextResponse.json({ error: 'Failed to fetch unanswered questions' }, { status: 500 })
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
    const question = String(body.question || '').trim()
    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const { data: created, error } = await supabase
      .from('unanswered_questions')
      .insert({
        clinic_id: current.clinic.id,
        conversation_id: body.conversationId ? String(body.conversationId) : null,
        question,
        source_page: body.sourcePage ? String(body.sourcePage) : null,
        status: 'open',
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating unanswered question:', error)
    return NextResponse.json({ error: 'Failed to create unanswered question' }, { status: 500 })
  }
}
