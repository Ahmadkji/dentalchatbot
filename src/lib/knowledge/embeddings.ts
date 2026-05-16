import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type EmbedResponse = {
  model: string
  dimension: number
  vectors: number[][]
}

export function serializePgVector(vector: number[]) {
  return `[${vector.map((value) => Number(value.toFixed(8))).join(',')}]`
}

export async function embedTexts384(inputs: string[]) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.functions.invoke('embed', {
    body: { inputs },
  })

  if (error) {
    throw error
  }

  const parsed = data as EmbedResponse
  if (!parsed?.vectors?.length) {
    throw new Error('Embedding function returned no vectors.')
  }

  return parsed
}

export async function embedText384(input: string) {
  const parsed = await embedTexts384([input])
  return parsed.vectors[0] ?? null
}
