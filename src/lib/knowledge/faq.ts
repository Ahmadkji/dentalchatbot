import 'server-only'

import {
  createKnowledgeSourceDraft,
  disableKnowledgeSource,
  type KnowledgeSourceRow,
  syncKnowledgeSourceContent,
  type SupabaseLikeClient,
} from '@/lib/knowledge/sources'

export interface FaqEntryRow {
  id: string
  clinic_id: string
  knowledge_source_id: string | null
  question: string
  answer: string
  category: string | null
  is_active: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

function buildFaqSourceContent(faq: Pick<FaqEntryRow, 'question' | 'answer' | 'category'>) {
  const categoryLine = faq.category?.trim() ? `Category: ${faq.category.trim()}\n` : ''
  return `${categoryLine}Question: ${faq.question.trim()}\nAnswer: ${faq.answer.trim()}`
}

function mapFaqRow(row: FaqEntryRow) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    order: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listFaqEntriesForClinic(
  supabase: SupabaseLikeClient,
  clinicId: string,
  options?: { activeOnly?: boolean },
) {
  let query = supabase
    .from('faq_entries')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (options?.activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return ((data ?? []) as FaqEntryRow[]).map(mapFaqRow)
}

export async function getFaqEntryForClinic(
  supabase: SupabaseLikeClient,
  clinicId: string,
  faqId: string,
) {
  const { data, error } = await supabase
    .from('faq_entries')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('id', faqId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as FaqEntryRow | null) ?? null
}

async function createFaqKnowledgeSource(
  supabase: SupabaseLikeClient,
  faq: FaqEntryRow,
) {
  const created = await createKnowledgeSourceDraft(supabase, {
    clinicId: faq.clinic_id,
    title: faq.question,
    sourceType: 'faq',
    content: buildFaqSourceContent(faq),
    createdBy: faq.created_by,
    metadata: {
      faqEntryId: faq.id,
      category: faq.category,
    },
    status: faq.is_active ? 'processing' : 'disabled',
  })

  const { error: linkError } = await supabase
    .from('faq_entries')
    .update({ knowledge_source_id: created.id })
    .eq('id', faq.id)
    .eq('clinic_id', faq.clinic_id)

  if (linkError) {
    throw linkError
  }

  return created
}

async function syncFaqKnowledgeSource(
  supabase: SupabaseLikeClient,
  faq: FaqEntryRow,
  knowledgeSource?: KnowledgeSourceRow | null,
) {
  const source = knowledgeSource ?? (faq.knowledge_source_id
    ? ((
        await supabase
          .from('knowledge_sources')
          .select('*')
          .eq('clinic_id', faq.clinic_id)
          .eq('id', faq.knowledge_source_id)
          .maybeSingle()
      ).data as KnowledgeSourceRow | null)
    : null)

  const activeSource = source ?? (await createFaqKnowledgeSource(supabase, faq))

  if (!faq.is_active) {
    await disableKnowledgeSource(supabase, activeSource.id)
    return
  }

  await supabase
    .from('knowledge_sources')
    .update({
      title: faq.question,
      content: buildFaqSourceContent(faq),
      source_type: 'faq',
      status: 'processing',
      is_active: true,
      failed_reason: null,
      metadata: {
        faqEntryId: faq.id,
        category: faq.category,
      },
    })
    .eq('clinic_id', faq.clinic_id)
    .eq('id', activeSource.id)

  await syncKnowledgeSourceContent(supabase, {
    sourceId: activeSource.id,
    title: faq.question,
    content: buildFaqSourceContent(faq),
    sourceType: 'faq',
    pageTitle: faq.question,
    sectionHeading: faq.category ?? 'FAQ',
  })
}

export async function createFaqEntry(
  supabase: SupabaseLikeClient,
  input: {
    clinicId: string
    question: string
    answer: string
    category?: string | null
    sortOrder: number
    isActive: boolean
    createdBy?: string | null
  },
) {
  const { data, error } = await supabase
    .from('faq_entries')
    .insert({
      clinic_id: input.clinicId,
      question: input.question,
      answer: input.answer,
      category: input.category ?? null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const row = data as FaqEntryRow
  await syncFaqKnowledgeSource(supabase, row)
  const refreshed = await getFaqEntryForClinic(supabase, input.clinicId, row.id)
  return refreshed ? mapFaqRow(refreshed) : mapFaqRow(row)
}

export async function updateFaqEntry(
  supabase: SupabaseLikeClient,
  clinicId: string,
  faqId: string,
  patch: Partial<{
    question: string
    answer: string
    category: string | null
    order: number
    isActive: boolean
  }>,
) {
  const existing = await getFaqEntryForClinic(supabase, clinicId, faqId)
  if (!existing) {
    return null
  }

  const updateData: Record<string, unknown> = {}
  if (patch.question !== undefined) updateData.question = patch.question
  if (patch.answer !== undefined) updateData.answer = patch.answer
  if (patch.category !== undefined) updateData.category = patch.category
  if (patch.order !== undefined) updateData.sort_order = patch.order
  if (patch.isActive !== undefined) updateData.is_active = patch.isActive

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('faq_entries')
      .update(updateData)
      .eq('clinic_id', clinicId)
      .eq('id', faqId)

    if (error) {
      throw error
    }
  }

  const refreshed = await getFaqEntryForClinic(supabase, clinicId, faqId)
  if (!refreshed) {
    return null
  }

  await syncFaqKnowledgeSource(supabase, refreshed)
  return mapFaqRow(refreshed)
}

export async function deleteFaqEntry(
  supabase: SupabaseLikeClient,
  clinicId: string,
  faqId: string,
) {
  const existing = await getFaqEntryForClinic(supabase, clinicId, faqId)
  if (!existing) {
    return false
  }

  if (existing.knowledge_source_id) {
    await disableKnowledgeSource(supabase, existing.knowledge_source_id)
  }

  const { error } = await supabase
    .from('faq_entries')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('id', faqId)

  if (error) {
    throw error
  }

  return true
}

