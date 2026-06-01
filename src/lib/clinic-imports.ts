import 'server-only'

import type { createSupabaseRouteClient } from '@/lib/supabase/route-client'
import { importWebsiteContent, normalizeKnowledgeImportUrlForStorage } from '@/lib/knowledge-import'
import { clinicProfileUpdateSchema, normalizeClinicProfileUpdate } from '@/lib/clinics/validation'
import { getCurrentClinicSnapshot, mapClinicToAppProfile } from '@/lib/clinics/current'
import { extractWebsiteAutofill, type WebsiteAutofill } from '@/lib/ai/website-autofill'
import {
  buildAutofillDetectedFields,
  buildBotSettingsFromAutofill,
  buildClinicHoursFromAutofill,
  buildClinicProfileUpdatePolicyFromAutofill,
  buildClinicSettingsFromAutofill,
  buildServicePayloadsFromAutofill,
  buildWidgetSettingsFromAutofill,
} from '@/lib/clinic-imports/autofill'

type SupabaseRouteClient = NonNullable<Awaited<ReturnType<typeof createSupabaseRouteClient>>>

type ImportSessionStatus = 'draft' | 'reviewed' | 'approved' | 'failed' | 'cancelled'
type ImportFetchStatus = 'pending' | 'fetched' | 'failed'
export type ImportFieldType =
  | 'name'
  | 'phone'
  | 'whatsapp'
  | 'address'
  | 'city'
  | 'opening_hours'
  | 'pricing_notes'
  | 'emergency_instructions'

interface ClinicImportSessionRow {
  id: string
  clinic_id: string
  website_url: string
  status: ImportSessionStatus
  fetch_status: ImportFetchStatus
  error_message: string | null
  created_by: string | null
  created_at: string
  reviewed_at: string | null
  approved_at: string | null
}

interface ClinicImportDetectedFieldRow {
  id: string
  import_session_id: string
  field_type: ImportFieldType
  detected_value: string
  source_url: string
  source_text_snippet: string
  confidence: number
  approved: boolean
  approved_value: string | null
  created_at: string
  updated_at: string
}

const sessionSelect =
  'id,clinic_id,website_url,status,fetch_status,error_message,created_by,created_at,reviewed_at,approved_at'

const fieldSelect =
  'id,import_session_id,field_type,detected_value,source_url,source_text_snippet,confidence,approved,approved_value,created_at,updated_at'

const fieldMeta: Record<ImportFieldType, { label: string; targetField: string; canApply: boolean; reason?: string }> = {
  name: { label: 'Clinic Name', targetField: 'name', canApply: true },
  phone: { label: 'Primary Phone', targetField: 'primaryPhone', canApply: true },
  whatsapp: { label: 'WhatsApp', targetField: 'whatsappNumber', canApply: true },
  address: { label: 'Address', targetField: 'address', canApply: true },
  city: { label: 'City', targetField: 'city', canApply: true },
  opening_hours: {
    label: 'Opening Hours',
    targetField: 'openingHours',
    canApply: false,
    reason: 'Opening hours still need structured weekly review in Clinic Hours.',
  },
  pricing_notes: { label: 'Pricing Notes', targetField: 'pricingNotes', canApply: true },
  emergency_instructions: { label: 'Emergency Instructions', targetField: 'emergencyInstructions', canApply: true },
}

export interface ClinicImportDetectedField {
  id: string
  field: ImportFieldType
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  targetField: string
  sourceUrl: string
  sourceSnippet: string
  approved: boolean
  approvedValue: string | null
  canApply: boolean
  reason?: string
}

export interface ClinicImportSession {
  id: string
  clinicId: string
  websiteUrl: string
  status: ImportSessionStatus
  fetchStatus: ImportFetchStatus
  errorMessage: string | null
  createdBy: string | null
  createdAt: string
  reviewedAt: string | null
  approvedAt: string | null
  detectedFields: ClinicImportDetectedField[]
}

interface RawDetectedField {
  fieldType: ImportFieldType
  value: string
  confidence: number
  sourceSnippet: string
}

function mapAutofillDetectedFields(
  autofill: WebsiteAutofill,
  sourceUrl: string,
) {
  return buildAutofillDetectedFields(autofill).map((field) => ({
    import_session_id: '',
    field_type: field.fieldType,
    detected_value: field.detectedValue,
    source_url: field.sourceUrl || sourceUrl,
    source_text_snippet: field.sourceTextSnippet,
    confidence: field.confidence,
    approved: true,
    approved_value: field.detectedValue,
  }))
}

function confidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.75) return 'high'
  if (confidence >= 0.45) return 'medium'
  return 'low'
}

function extractPattern(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return null
}

function normalizeSnippet(value: string, maxLength = 220) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function detectClinicName(content: string) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)

  const lineMatch = lines.find(
    (line) =>
      /^[A-Z][A-Za-z&'.-]+(?:\s+[A-Z][A-Za-z&'.-]+){1,6}$/.test(line) &&
      /(?:Dental|Clinic|Center|Care)/i.test(line) &&
      !/^(?:phone|tel|call|whatsapp|address|location|hours?|timings?|open(?:ing)?|pricing|price|fee|cost|emergency)\b/i.test(
        line,
      ) &&
      line.length >= 5 &&
      line.length <= 80,
  )

  if (lineMatch) {
    return {
      value: lineMatch,
      sourceSnippet: normalizeSnippet(lineMatch),
      confidence: 0.75,
    }
  }

  const titleMatch =
    content.match(/^\s*([A-Z][^\n]{2,80}(?:Dental|Clinic|Center|Care)[^\n]*)$/m) ||
    content.match(/(?:clinic name|dental clinic|dental center)[: \t]*([^\n,]{5,60})/i) ||
    content.match(/^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Dental|Clinic|Center|Care))/m)

  if (!titleMatch) {
    return null
  }

  return {
    value: titleMatch[1] ? titleMatch[1].trim() : titleMatch[0].trim(),
    sourceSnippet: normalizeSnippet(titleMatch[0]),
    confidence: 0.6,
  }
}

export function detectClinicImportFields(content: string) {
  const lower = content.toLowerCase()
  const details: RawDetectedField[] = []

  const clinicName = detectClinicName(content)
  if (clinicName) {
    details.push({
      fieldType: 'name',
      value: clinicName.value,
      confidence: clinicName.confidence,
      sourceSnippet: clinicName.sourceSnippet,
    })
  }

  const phone = extractPattern(content, [
    /\+\d[\d\s().-]{7,18}\d/,
    /(?:phone|tel|call)[:\s]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i,
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  ])
  if (phone) {
    details.push({
      fieldType: 'phone',
      value: phone.replace(/^(?:phone|tel|call)[:\s]*/i, '').trim(),
      confidence: 0.9,
      sourceSnippet: normalizeSnippet(phone),
    })
  }

  const whatsapp = extractPattern(content, [/whatsapp[:\s]*\+?\d[\d\s().-]{7,18}\d/i])
  if (whatsapp) {
    details.push({
      fieldType: 'whatsapp',
      value: whatsapp.replace(/whatsapp[:\s]*/i, '').trim(),
      confidence: 0.9,
      sourceSnippet: normalizeSnippet(whatsapp),
    })
  }

  const address = extractPattern(content, [
    /(?:address|location)[:\s]*.{10,100}(?:\d{5,6})?/i,
    /\d+\s+\w+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)[\w\s,]+(?:\d{5,6})?/i,
  ])
  if (address) {
    const cleaned = address.replace(/^(?:address|location)[:\s]*/i, '').trim()
    details.push({
      fieldType: 'address',
      value: cleaned,
      confidence: 0.6,
      sourceSnippet: normalizeSnippet(address),
    })

    const cityMatch = cleaned.match(/,\s*([A-Za-z\s]+?)(?:\s*,|\s+\d{5,6}|$)/)
    if (cityMatch && cityMatch[1].trim().length > 1) {
      details.push({
        fieldType: 'city',
        value: cityMatch[1].trim(),
        confidence: 0.35,
        sourceSnippet: normalizeSnippet(address),
      })
    }
  }

  const hours = extractPattern(content, [
    /(?:hours?|timings?|open(?:ing)?)[:\s]*.{10,80}(?:pm|am|noon|midnight)/i,
    /(?:mon|tue|wed|thu|fri|sat|sun)[\w\s,-]*(?:pm|am)/i,
  ])
  if (hours) {
    details.push({
      fieldType: 'opening_hours',
      value: hours.replace(/^(?:hours?|timings?|open(?:ing)?)[:\s]*/i, '').trim(),
      confidence: 0.6,
      sourceSnippet: normalizeSnippet(hours),
    })
  }

  const pricing = extractPattern(content, [
    /(?:consultation|pricing|fee|cost)[\s\S]{0,80}(?:rs\.|₹|\$)\s*[\d,]+/i,
    /(?:price|pricing|fee|cost|rs\.|₹|\$)[\s\S]{0,80}(?:consultation|treatment)/i,
  ])
  if (pricing) {
    details.push({
      fieldType: 'pricing_notes',
      value: pricing.trim().substring(0, 200),
      confidence: 0.6,
      sourceSnippet: normalizeSnippet(pricing),
    })
  }

  if (lower.includes('emergency')) {
    const emergency = extractPattern(content, [
      /emergency[\s\S]{0,60}(?:\d{3}[-.\s]?){2}\d{4}/i,
      /emergency[\s\S]{0,60}\+\d{1,3}\d{6,14}/i,
      /emergency[\s\S]{0,100}(?:call|phone|line|contact|instructions)/i,
    ])

    if (emergency) {
      details.push({
        fieldType: 'emergency_instructions',
        value: emergency.trim().substring(0, 200),
        confidence: 0.6,
        sourceSnippet: normalizeSnippet(emergency),
      })
    }
  }

  return details
}

function mapDetectedField(row: ClinicImportDetectedFieldRow): ClinicImportDetectedField {
  const meta = fieldMeta[row.field_type]

  return {
    id: row.id,
    field: row.field_type,
    label: meta.label,
    value: row.detected_value,
    confidence: confidenceLabel(row.confidence),
    confidenceScore: row.confidence,
    targetField: meta.targetField,
    sourceUrl: row.source_url,
    sourceSnippet: row.source_text_snippet,
    approved: row.approved,
    approvedValue: row.approved_value,
    canApply: meta.canApply,
    reason: meta.reason,
  }
}

async function getDetectedFieldsForSession(supabase: SupabaseRouteClient, sessionId: string) {
  const { data, error } = await supabase
    .from('clinic_import_detected_fields')
    .select(fieldSelect)
    .eq('import_session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ClinicImportDetectedFieldRow[]
}

export async function getClinicImportSession(
  supabase: SupabaseRouteClient,
  clinicId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from('clinic_import_sessions')
    .select(sessionSelect)
    .eq('clinic_id', clinicId)
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) return null

  const fields = await getDetectedFieldsForSession(supabase, sessionId)
  return {
    id: data.id,
    clinicId: data.clinic_id,
    websiteUrl: data.website_url,
    status: data.status,
    fetchStatus: data.fetch_status,
    errorMessage: data.error_message,
    createdBy: data.created_by,
    createdAt: data.created_at,
    reviewedAt: data.reviewed_at,
    approvedAt: data.approved_at,
    detectedFields: fields.map(mapDetectedField),
  } satisfies ClinicImportSession
}

export async function createClinicImportSession(
  supabase: SupabaseRouteClient,
  clinicId: string,
  userId: string,
  websiteUrl: string,
  options?: { defaultCountry?: string | null },
) {
  const canonicalUrl = normalizeKnowledgeImportUrlForStorage(websiteUrl)
  const { data: sessionRow, error: sessionError } = await supabase
    .from('clinic_import_sessions')
    .insert({
      clinic_id: clinicId,
      website_url: canonicalUrl,
      status: 'draft',
      fetch_status: 'pending',
      created_by: userId,
    })
    .select(sessionSelect)
    .single()

  if (sessionError) {
    throw sessionError
  }

  try {
    const imported = await importWebsiteContent(canonicalUrl)
    const importedStorageUrl = normalizeKnowledgeImportUrlForStorage(imported.url)
    const autofill = await extractWebsiteAutofill({
      websiteUrl: importedStorageUrl,
      title: imported.title,
      text: imported.content,
    })
    const clinicProfilePolicy = buildClinicProfileUpdatePolicyFromAutofill(autofill, {
      defaultCountry: options?.defaultCountry ?? null,
    })
    const skippedDetectedFieldTypes = new Set(
      clinicProfilePolicy.skippedFields.filter((field): field is ImportFieldType => field === 'phone' || field === 'whatsapp'),
    )

    const detectedFieldInputs = mapAutofillDetectedFields(autofill, importedStorageUrl).map((field) => ({
      import_session_id: sessionRow.id,
      field_type: field.field_type,
      detected_value: field.detected_value,
      source_url: field.source_url,
      source_text_snippet: field.source_text_snippet,
      confidence: field.confidence,
      approved: !skippedDetectedFieldTypes.has(field.field_type),
      approved_value: skippedDetectedFieldTypes.has(field.field_type) ? null : field.approved_value,
    }))

    let detectedFields: ClinicImportDetectedFieldRow[] = []
    if (detectedFieldInputs.length > 0) {
      const { data: insertedFields, error: insertFieldsError } = await supabase
        .from('clinic_import_detected_fields')
        .insert(detectedFieldInputs)
        .select(fieldSelect)

      if (insertFieldsError) {
        throw insertFieldsError
      }

      detectedFields = (insertedFields ?? []) as ClinicImportDetectedFieldRow[]
    }

    const { error: updateSessionError } = await supabase
      .from('clinic_import_sessions')
      .update({
        website_url: importedStorageUrl,
        status: 'reviewed',
        fetch_status: 'fetched',
        error_message: null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sessionRow.id)

    if (updateSessionError) {
      throw updateSessionError
    }

    const clinicUpdate = clinicProfilePolicy.updateData
    const widgetUpdate = buildWidgetSettingsFromAutofill(autofill)
    const botUpdate = buildBotSettingsFromAutofill(autofill)
    const settingsUpdate = Object.fromEntries(
      buildClinicSettingsFromAutofill(autofill).map((row) => [row.key, row.value]),
    )
    const hoursPayload = buildClinicHoursFromAutofill(autofill)
    const servicesPayload = buildServicePayloadsFromAutofill(autofill)

    const { error: applyError } = await supabase.rpc('apply_website_autofill', {
      p_session_id: sessionRow.id,
      p_approvals: detectedFields.map((field) => ({
        field_id: field.id,
        approved: !skippedDetectedFieldTypes.has(field.field_type),
        approved_value: skippedDetectedFieldTypes.has(field.field_type)
          ? null
          : field.approved_value ?? field.detected_value,
      })),
      p_clinic_update: clinicUpdate,
      p_widget_update: widgetUpdate,
      p_bot_update: botUpdate,
      p_settings_update: settingsUpdate,
      p_hours: hoursPayload,
      p_services: servicesPayload,
      p_error_message: null,
    })

    if (applyError) {
      throw applyError
    }

    const session = await getClinicImportSession(supabase, clinicId, sessionRow.id)
    if (!session) {
      throw new Error('Import session could not be loaded after creation.')
    }

    const refreshed = await getCurrentClinicSnapshot(supabase, { id: userId })
    if (!refreshed.clinic) {
      throw new Error('Clinic could not be loaded after autofill approval.')
    }

    return {
      clinic: mapClinicToAppProfile(refreshed.clinic, refreshed.hours),
      session,
      importedTitle: autofill.knowledge.title || imported.title,
      contentPreview: autofill.knowledge.summary || imported.content.substring(0, 500),
      warnings: [
        ...autofill.flags.reasons,
        ...clinicProfilePolicy.warnings,
        ...(widgetUpdate.allowed_domains.length === 0
          ? ['Skipped widget allowed domains because the imported website did not expose a secure https origin.']
          : []),
      ],
      autoApplied: true,
    }
  } catch (error) {
    const { error: statusUpdateError } = await supabase
      .from('clinic_import_sessions')
      .update({
        status: 'failed',
        fetch_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Website import failed.',
      })
      .eq('id', sessionRow.id)

    if (statusUpdateError) {
      console.error('[clinic-imports] Failed to update import session status to failed', {
        sessionId: sessionRow.id,
        originalError: error instanceof Error ? error.message : String(error),
        statusUpdateError: statusUpdateError.message,
      })
    }

    throw error
  }
}

function buildClinicUpdatePayload(
  approvedFields: Array<{ field_type: ImportFieldType; value: string }>,
) {
  const rawUpdate: Record<string, unknown> = {}
  const unsupported: string[] = []

  for (const field of approvedFields) {
    switch (field.field_type) {
      case 'name':
        rawUpdate.name = field.value
        break
      case 'phone':
        rawUpdate.phone = field.value
        break
      case 'whatsapp':
        rawUpdate.whatsapp = field.value
        break
      case 'address':
        rawUpdate.address = field.value
        break
      case 'city':
        rawUpdate.city = field.value
        break
      case 'pricing_notes':
        rawUpdate.pricing_notes = field.value
        break
      case 'emergency_instructions':
        rawUpdate.emergency_instructions = field.value
        break
      case 'opening_hours':
        unsupported.push('opening_hours')
        break
      default:
        break
    }
  }

  const parsed = clinicProfileUpdateSchema.safeParse(rawUpdate)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid clinic import approval payload.')
  }

  return {
    updateData: normalizeClinicProfileUpdate(parsed.data),
    unsupported,
  }
}

export async function approveClinicImportSession(
  supabase: SupabaseRouteClient,
  clinicId: string,
  userId: string,
  sessionId: string,
  approvals: Array<{ fieldId: string; approved: boolean; approvedValue?: string }>,
) {
  const session = await getClinicImportSession(supabase, clinicId, sessionId)
  if (!session) {
    throw new Error('Import session not found.')
  }

  if (session.status === 'approved') {
    throw new Error('This import session has already been approved.')
  }

  if (session.status === 'cancelled') {
    throw new Error('This import session was cancelled.')
  }

  const approvalMap = new Map(approvals.map((approval) => [approval.fieldId, approval]))
  const approvedFieldsForClinicUpdate: Array<{ field_type: ImportFieldType; value: string }> = []
  const rpcApprovals: Array<{ field_id: string; approved: boolean; approved_value: string | null }> = []

  for (const field of session.detectedFields) {
    const approval = approvalMap.get(field.id)
    if (!approval) continue

    const approvedValue = (approval.approvedValue ?? field.value).trim()
    rpcApprovals.push({
      field_id: field.id,
      approved: approval.approved,
      approved_value: approval.approved ? approvedValue : null,
    })

    if (approval.approved) {
      approvedFieldsForClinicUpdate.push({
        field_type: field.field,
        value: approvedValue,
      })
    }
  }

  const { updateData, unsupported } = buildClinicUpdatePayload(approvedFieldsForClinicUpdate)
  const { error: approveError } = await supabase.rpc('approve_clinic_import_session', {
    p_session_id: sessionId,
    p_approvals: rpcApprovals,
    p_clinic_update: updateData,
    p_error_message: unsupported.length > 0 ? 'Some approved fields still need manual structured review.' : null,
  })

  if (approveError) {
    throw approveError
  }

  const refreshed = await getCurrentClinicSnapshot(supabase, { id: userId })
  if (!refreshed.clinic) {
    throw new Error('Clinic could not be loaded after import approval.')
  }

  return {
    clinic: mapClinicToAppProfile(refreshed.clinic, refreshed.hours),
    warnings: unsupported,
    session: await getClinicImportSession(supabase, clinicId, sessionId),
  }
}

export async function cancelClinicImportSession(
  supabase: SupabaseRouteClient,
  clinicId: string,
  sessionId: string,
) {
  const { error } = await supabase
    .from('clinic_import_sessions')
    .update({
      status: 'cancelled',
      reviewed_at: new Date().toISOString(),
    })
    .eq('clinic_id', clinicId)
    .eq('id', sessionId)

  if (error) {
    throw error
  }
}
