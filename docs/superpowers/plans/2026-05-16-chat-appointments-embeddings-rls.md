# Chat Automation, Appointment Confirmation, Hybrid Retrieval, and Live RLS Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chatbot create real leads and appointment requests safely, let staff convert requests into confirmed appointments atomically, add hybrid lexical plus vector retrieval without breaking the current knowledge schema, and prove tenant isolation live against Supabase.

**Architecture:** Keep this as an additive MVP hardening pass. We do not replace the current chat, knowledge, or appointment flows. We add small helper modules, one new migration, one Edge Function for embeddings, one confirm route, and live verification scripts. Existing routes keep working while the new safety and automation layers are added on top.

**Tech Stack:** Next.js App Router, Supabase Postgres, Supabase Edge Functions, pgvector, Vitest, shell scripts for live verification

---

## Scope Boundary

### In scope
- Real chatbot automation for leads and appointment requests
- Staff-only appointment request to confirmed appointment conversion
- Hybrid knowledge retrieval with lexical fallback
- Live Supabase migration apply and RLS verification

### Not in scope for this pass
- Google Calendar sync
- Email notifications
- Website import approval UI redesign
- Replacing the current LLM provider
- Full medical triage engine

---

## File Map

### Create
- `supabase/migrations/20260516123000_chat_appointments_embeddings_rls.sql`
- `supabase/functions/embed/index.ts`
- `src/lib/chat/automation.ts`
- `src/lib/chat/automation.test.ts`
- `src/lib/knowledge/embeddings.ts`
- `src/lib/knowledge/embeddings.test.ts`
- `src/app/api/appointment-requests/[id]/confirm/route.ts`
- `src/app/api/appointment-requests/[id]/confirm/route.test.ts`
- `scripts/security/verify-live-rls.sh`

### Modify
- `src/app/api/chat/route.ts`
- `src/app/api/appointment-requests/route.ts`
- `src/app/api/appointment-requests/[id]/route.ts`
- `src/lib/knowledge/sources.ts`
- `src/lib/knowledge/sources.test.ts`
- `src/lib/knowledge/jobs.ts`
- `src/app/api/chat/route.test.ts`
- `src/components/appointment-requests-page.tsx`

---

## Decision Summary

### Selected approach
1. Use deterministic chatbot automation helpers, not prompt-only lead logic.
2. Use a database RPC for appointment confirmation so insert plus update is atomic.
3. Keep the existing `embedding` 1536 column untouched and add a new `embedding_384` column for Supabase `gte-small`.
4. Keep lexical search as the fallback path so chatbot answers do not fail if embeddings fail.
5. Prove RLS live with direct REST calls and route-level checks, not only unit tests.

### Rejected approaches
1. **Change the existing `embedding` column from 1536 to 384 in place**
   - Rejected because it is risky for existing schema history and gives us no rollback safety.
2. **Confirm appointments with a plain `PATCH` on `appointment_requests`**
   - Rejected because it cannot guarantee atomic insert plus status update under concurrency.
3. **Do chatbot automation only through prompt instructions**
   - Rejected because retries, duplicate actions, and partial data capture become unreliable.
4. **Call live RLS “done” without direct REST checks**
   - Rejected because route handlers use service role and RLS alone would be incomplete proof.

---

## Task 1: Database Contract for Automation, Confirm Flow, and Vector Search

**Files:**
- Create: `supabase/migrations/20260516123000_chat_appointments_embeddings_rls.sql`

- [ ] **Step 1: Create the migration file**

Run:

```bash
supabase migration new chat_appointments_embeddings_rls
```

Then replace the generated file contents with:

```sql
-- =============================================
-- Chat automation, appointment confirmation,
-- hybrid retrieval, and live-verification helpers
-- =============================================

alter table public.conversations
  add column if not exists automation_state jsonb not null default jsonb_build_object(
    'leadId', null,
    'appointmentRequestId', null,
    'fields', jsonb_build_object()
  );

alter table public.leads
  add column if not exists automation_key text;

alter table public.appointment_requests
  add column if not exists automation_key text;

create unique index if not exists idx_leads_clinic_automation_key
  on public.leads(clinic_id, automation_key);

create unique index if not exists idx_appointment_requests_clinic_automation_key
  on public.appointment_requests(clinic_id, automation_key);

alter table public.knowledge_chunks
  add column if not exists embedding_384 extensions.vector(384);

create index if not exists idx_knowledge_chunks_embedding_384_hnsw
  on public.knowledge_chunks
  using hnsw (embedding_384 vector_cosine_ops)
  where embedding_384 is not null and is_active = true;

create or replace function public.update_knowledge_chunk_embeddings_384(
  p_source_id uuid,
  p_embeddings jsonb,
  p_embedding_model text default 'gte-small'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.knowledge_sources;
  v_item jsonb;
  v_updated integer := 0;
  v_row_count integer := 0;
begin
  if current_user <> 'service_role' and v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id
  for update;

  if v_source.id is null then
    raise exception 'Knowledge source not found.';
  end if;

  if current_user <> 'service_role'
     and not public.has_clinic_role(v_source.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to manage this knowledge source.';
  end if;

  if jsonb_typeof(p_embeddings) <> 'array' then
    raise exception 'Embeddings payload must be an array.';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_embeddings)
  loop
    update public.knowledge_chunks
    set
      embedding_384 = (v_item ->> 'embedding_384')::extensions.vector(384),
      embedding_model = coalesce(nullif(p_embedding_model, ''), 'gte-small'),
      embedding_dimension = 384,
      updated_at = now()
    where source_id = p_source_id
      and sort_order = (v_item ->> 'sort_order')::int
      and is_active = true;

    get diagnostics v_row_count = row_count;
    v_updated := v_updated + v_row_count;
  end loop;

  update public.knowledge_processing_runs
  set embeddings_created = v_updated
  where id = (
    select id
    from public.knowledge_processing_runs
    where source_id = p_source_id
    order by started_at desc
    limit 1
  );

  return v_updated;
end;
$$;

revoke all on function public.update_knowledge_chunk_embeddings_384(uuid, jsonb, text) from public;
grant execute on function public.update_knowledge_chunk_embeddings_384(uuid, jsonb, text) to service_role;

create or replace function public.match_knowledge_chunks_384(
  p_clinic_id uuid,
  p_query_embedding extensions.vector(384),
  p_match_count int default 8,
  p_match_threshold double precision default 0.72
)
returns table (
  id uuid,
  clinic_id uuid,
  source_id uuid,
  chunk_text text,
  sort_order int,
  token_count int,
  source_type text,
  source_url text,
  page_title text,
  section_heading text,
  file_name text,
  last_synced_at timestamptz,
  updated_at timestamptz,
  retrieval_score double precision,
  score_type text,
  knowledge_sources jsonb
)
language sql
stable
set search_path = public
as $$
  select
    kc.id,
    kc.clinic_id,
    kc.source_id,
    kc.chunk_text,
    kc.sort_order,
    kc.token_count,
    kc.source_type,
    kc.source_url,
    kc.page_title,
    kc.section_heading,
    kc.file_name,
    kc.last_synced_at,
    kc.updated_at,
    (1 - (kc.embedding_384 <=> p_query_embedding))::double precision as retrieval_score,
    'vector'::text as score_type,
    jsonb_build_object(
      'id', ks.id,
      'title', ks.title,
      'source_type', ks.source_type,
      'status', ks.status,
      'is_active', ks.is_active
    ) as knowledge_sources
  from public.knowledge_chunks kc
  join public.knowledge_sources ks on ks.id = kc.source_id
  where kc.clinic_id = p_clinic_id
    and kc.is_active = true
    and ks.is_active = true
    and ks.status = 'trained'
    and kc.embedding_384 is not null
    and (1 - (kc.embedding_384 <=> p_query_embedding)) >= p_match_threshold
  order by kc.embedding_384 <=> p_query_embedding asc
  limit greatest(1, least(coalesce(p_match_count, 8), 20));
$$;

revoke all on function public.match_knowledge_chunks_384(uuid, extensions.vector(384), int, double precision) from public;
grant execute on function public.match_knowledge_chunks_384(uuid, extensions.vector(384), int, double precision) to authenticated, service_role;

create or replace function public.confirm_appointment_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_start_date date,
  p_start_time time,
  p_duration_minutes int,
  p_service_id uuid default null,
  p_staff_id uuid default null,
  p_internal_note text default null
)
returns public.appointments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.appointment_requests;
  v_clinic public.clinics;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_appointment public.appointments;
begin
  if current_user <> 'service_role' and auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_request
  from public.appointment_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Appointment request not found.';
  end if;

  select *
  into v_clinic
  from public.clinics
  where id = v_request.clinic_id;

  if v_clinic.id is null then
    raise exception 'Clinic not found.';
  end if;

  if current_user <> 'service_role'
     and not public.has_clinic_role(v_request.clinic_id, array['owner', 'admin', 'staff']) then
    raise exception 'Not allowed to confirm this appointment.';
  end if;

  if v_request.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'This request can no longer be confirmed.';
  end if;

  if p_service_id is not null and not exists (
    select 1
    from public.services s
    where s.id = p_service_id
      and s.clinic_id = v_request.clinic_id
      and s.is_active = true
  ) then
    raise exception 'Service does not belong to this clinic.';
  end if;

  if p_staff_id is not null and not exists (
    select 1
    from public.clinic_staff cs
    where cs.id = p_staff_id
      and cs.clinic_id = v_request.clinic_id
      and cs.is_active = true
  ) then
    raise exception 'Staff member does not belong to this clinic.';
  end if;

  v_start_at := ((p_start_date::text || ' ' || p_start_time::text)::timestamp at time zone v_clinic.timezone);
  v_end_at := v_start_at + make_interval(mins => greatest(p_duration_minutes, 5));

  insert into public.appointments (
    clinic_id,
    appointment_request_id,
    lead_id,
    conversation_id,
    service_id,
    staff_id,
    patient_name,
    patient_phone,
    patient_email,
    starts_at,
    ends_at,
    timezone,
    status,
    source,
    internal_note,
    created_by
  )
  values (
    v_request.clinic_id,
    v_request.id,
    v_request.lead_id,
    v_request.conversation_id,
    p_service_id,
    p_staff_id,
    v_request.name,
    v_request.phone,
    v_request.email,
    v_start_at,
    v_end_at,
    v_clinic.timezone,
    'confirmed',
    'staff',
    p_internal_note,
    p_actor_user_id
  )
  on conflict (appointment_request_id) do update
  set
    service_id = excluded.service_id,
    staff_id = excluded.staff_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    internal_note = excluded.internal_note,
    updated_at = now()
  returning * into v_appointment;

  update public.appointment_requests
  set
    status = 'confirmed',
    service_id = p_service_id,
    staff_id = p_staff_id,
    preferred_date = p_start_date,
    preferred_time = to_char(p_start_time, 'HH24:MI'),
    staff_notes = p_internal_note,
    updated_at = now()
  where id = v_request.id;

  return v_appointment;
end;
$$;

revoke all on function public.confirm_appointment_request(uuid, uuid, date, time, int, uuid, uuid, text) from public;
grant execute on function public.confirm_appointment_request(uuid, uuid, date, time, int, uuid, uuid, text) to service_role;
```

- [ ] **Step 2: Apply the migration to a real Supabase project**

Run:

```bash
supabase link --project-ref "$(cat supabase/.temp/project-ref)"
supabase db push
```

Expected:

```text
Finished supabase db push.
```

---

## Task 2: Chatbot Automation Helpers

**Files:**
- Create: `src/lib/chat/automation.ts`
- Test: `src/lib/chat/automation.test.ts`

- [ ] **Step 1: Add deterministic automation helpers**

Create `src/lib/chat/automation.ts`:

```ts
import 'server-only'

import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { CLINIC_SETTING_DEFAULTS } from '@/lib/clinics/settings'

export type SupportLevel = 'strong' | 'medium' | 'weak'

export type LeadAutomationSettings = {
  collectionEnabled: boolean
  collectEmail: boolean
  collectName: boolean
  collectPhone: boolean
  triggerMode: 'interest' | 'always' | 'manual'
  triggerMessageCount: number
  triggerKeywords: string[]
  autoEscalation: boolean
}

export type ConversationAutomationState = {
  leadId: string | null
  appointmentRequestId: string | null
  fields: {
    name?: string
    phone?: string
    email?: string
    preferredDate?: string
    preferredTime?: string
    reason?: string
    preferredDoctor?: string
    serviceName?: string
  }
}

type ClinicSettingRowLike = {
  key: string
  value: string
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/
const TIME_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)\b/i
const PHONE_RE = /\+?[0-9][0-9()\s.-]{7,20}[0-9]/

export function defaultAutomationState(): ConversationAutomationState {
  return {
    leadId: null,
    appointmentRequestId: null,
    fields: {},
  }
}

export function normalizeAutomationState(input: unknown): ConversationAutomationState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return defaultAutomationState()
  }

  const value = input as Record<string, unknown>
  const fields = value.fields && typeof value.fields === 'object' && !Array.isArray(value.fields)
    ? (value.fields as Record<string, string>)
    : {}

  return {
    leadId: typeof value.leadId === 'string' ? value.leadId : null,
    appointmentRequestId: typeof value.appointmentRequestId === 'string' ? value.appointmentRequestId : null,
    fields: {
      name: typeof fields.name === 'string' ? fields.name : undefined,
      phone: typeof fields.phone === 'string' ? fields.phone : undefined,
      email: typeof fields.email === 'string' ? fields.email : undefined,
      preferredDate: typeof fields.preferredDate === 'string' ? fields.preferredDate : undefined,
      preferredTime: typeof fields.preferredTime === 'string' ? fields.preferredTime : undefined,
      reason: typeof fields.reason === 'string' ? fields.reason : undefined,
      preferredDoctor: typeof fields.preferredDoctor === 'string' ? fields.preferredDoctor : undefined,
      serviceName: typeof fields.serviceName === 'string' ? fields.serviceName : undefined,
    },
  }
}

export function mapLeadAutomationSettings(rows: ClinicSettingRowLike[]): LeadAutomationSettings {
  const defaults = new Map(
    CLINIC_SETTING_DEFAULTS
      .filter((row) => row.key.startsWith('lead_'))
      .map((row) => [row.key, row.value]),
  )

  for (const row of rows) {
    if (row.key.startsWith('lead_')) {
      defaults.set(row.key, row.value)
    }
  }

  return {
    collectionEnabled: defaults.get('lead_collection_enabled') !== 'false',
    collectEmail: defaults.get('lead_collect_email') !== 'false',
    collectName: defaults.get('lead_collect_name') !== 'false',
    collectPhone: defaults.get('lead_collect_phone') !== 'false',
    triggerMode: (defaults.get('lead_trigger_mode') as LeadAutomationSettings['triggerMode']) || 'interest',
    triggerMessageCount: Math.max(1, Number(defaults.get('lead_trigger_message_count') || '1')),
    triggerKeywords: String(defaults.get('lead_trigger_keywords') || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    autoEscalation: defaults.get('lead_auto_escalation') === 'true',
  }
}

export function extractAutomationFields(lines: string[]): ConversationAutomationState['fields'] {
  const text = lines.join('\n')
  const email = text.match(EMAIL_RE)?.[0]
  const rawPhone = text.match(PHONE_RE)?.[0]
  const parsedPhone = rawPhone ? parsePhoneNumberFromString(rawPhone, 'US') : null
  const preferredDate = text.match(ISO_DATE_RE)?.[0]
  const preferredTime = text.match(TIME_RE)?.[0]

  return {
    email,
    phone: parsedPhone?.isValid() ? parsedPhone.number : undefined,
    preferredDate,
    preferredTime,
  }
}

export function mergeAutomationState(
  previousState: unknown,
  extractedFields: ConversationAutomationState['fields'],
): ConversationAutomationState {
  const normalized = normalizeAutomationState(previousState)
  return {
    ...normalized,
    fields: {
      ...normalized.fields,
      ...Object.fromEntries(
        Object.entries(extractedFields).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
      ),
    },
  }
}

export function detectHumanHelpIntent(message: string) {
  return /(appointment|book|schedule|call me|contact me|quote|price|pricing|consultation)/i.test(message)
}

export function shouldCreateLead(input: {
  settings: LeadAutomationSettings
  state: ConversationAutomationState
  messageCount: number
  latestUserMessage: string
  supportLevel: SupportLevel
}) {
  if (!input.settings.collectionEnabled) return false
  if (input.state.leadId) return false
  if (input.settings.collectPhone && !input.state.fields.phone) return false

  if (input.settings.triggerMode === 'manual') return false
  if (input.settings.triggerMode === 'always') return true

  const lower = input.latestUserMessage.toLowerCase()
  const keywordHit = input.settings.triggerKeywords.some((keyword) => lower.includes(keyword))

  return (
    input.messageCount >= input.settings.triggerMessageCount ||
    keywordHit ||
    detectHumanHelpIntent(input.latestUserMessage) ||
    input.supportLevel === 'weak'
  )
}

export function shouldCreateAppointmentRequest(state: ConversationAutomationState) {
  return Boolean(
    !state.appointmentRequestId &&
    state.fields.phone &&
    state.fields.preferredDate &&
    state.fields.preferredTime
  )
}

export function canAnswerFromClinicProfile(message: string) {
  return /(hours|open|closed|address|location|where|phone|call|whatsapp|map|directions|book|appointment|schedule)/i.test(
    message,
  )
}

export function buildSafeAssistantReply(input: {
  aiResponse: string
  supportLevel: SupportLevel
  fallbackMessage: string
  latestUserMessage: string
}) {
  if (input.supportLevel === 'weak' && !canAnswerFromClinicProfile(input.latestUserMessage)) {
    return input.fallbackMessage
  }

  return input.aiResponse
}
```

- [ ] **Step 2: Add unit tests for the helper**

Create `src/lib/chat/automation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildSafeAssistantReply,
  canAnswerFromClinicProfile,
  defaultAutomationState,
  extractAutomationFields,
  mapLeadAutomationSettings,
  mergeAutomationState,
  shouldCreateAppointmentRequest,
  shouldCreateLead,
} from '@/lib/chat/automation'

describe('chat automation helpers', () => {
  it('maps lead settings from full clinic setting keys', () => {
    const settings = mapLeadAutomationSettings([
      { key: 'lead_collection_enabled', value: 'true' },
      { key: 'lead_trigger_mode', value: 'interest' },
      { key: 'lead_trigger_message_count', value: '2' },
      { key: 'lead_trigger_keywords', value: 'price,appointment' },
    ])

    expect(settings.triggerMode).toBe('interest')
    expect(settings.triggerMessageCount).toBe(2)
    expect(settings.triggerKeywords).toEqual(['price', 'appointment'])
  })

  it('extracts phone, email, date, and time from transcript text', () => {
    const fields = extractAutomationFields([
      'user: my phone is (415) 555-2671',
      'user: email me at hello@example.com',
      'user: 2026-05-30 at 10:30 am works',
    ])

    expect(fields.phone).toBe('+14155552671')
    expect(fields.email).toBe('hello@example.com')
    expect(fields.preferredDate).toBe('2026-05-30')
    expect(fields.preferredTime?.toLowerCase()).toContain('10:30')
  })

  it('creates a lead only once after trigger rules are met', () => {
    const state = mergeAutomationState(defaultAutomationState(), { phone: '+14155552671' })
    expect(
      shouldCreateLead({
        settings: mapLeadAutomationSettings([]),
        state,
        messageCount: 2,
        latestUserMessage: 'I want to book an appointment',
        supportLevel: 'medium',
      }),
    ).toBe(true)

    expect(
      shouldCreateLead({
        settings: mapLeadAutomationSettings([]),
        state: { ...state, leadId: 'lead-1' },
        messageCount: 3,
        latestUserMessage: 'following up',
        supportLevel: 'medium',
      }),
    ).toBe(false)
  })

  it('creates an appointment request only after phone, date, and time exist', () => {
    expect(
      shouldCreateAppointmentRequest({
        leadId: 'lead-1',
        appointmentRequestId: null,
        fields: {
          phone: '+14155552671',
          preferredDate: '2026-05-30',
          preferredTime: '10:30',
        },
      }),
    ).toBe(true)
  })

  it('forces fallback on weak support', () => {
    expect(
      buildSafeAssistantReply({
        aiResponse: 'Maybe it costs 100',
        supportLevel: 'weak',
        fallbackMessage: 'Please contact the clinic directly so staff can help you correctly.',
        latestUserMessage: 'how much does it cost',
      }),
    ).toBe('Please contact the clinic directly so staff can help you correctly.')
  })

  it('keeps direct clinic-profile answers even when chunk support is weak', () => {
    expect(canAnswerFromClinicProfile('what are your hours')).toBe(true)

    expect(
      buildSafeAssistantReply({
        aiResponse: 'We are open Monday to Friday from 9 AM to 5 PM.',
        supportLevel: 'weak',
        fallbackMessage: 'Please contact the clinic directly so staff can help you correctly.',
        latestUserMessage: 'what are your hours',
      }),
    ).toBe('We are open Monday to Friday from 9 AM to 5 PM.')
  })
})
```

---

## Task 3: Wire Chatbot Automation into the Real Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Test: `src/app/api/chat/route.test.ts`

- [ ] **Step 1: Update imports**

Add these imports near the top of `src/app/api/chat/route.ts`:

```ts
import {
  buildSafeAssistantReply,
  extractAutomationFields,
  mapLeadAutomationSettings,
  mergeAutomationState,
  shouldCreateAppointmentRequest,
  shouldCreateLead,
} from '@/lib/chat/automation'
```

- [ ] **Step 2: Load lead settings from the real `clinic_settings` table**

Add this helper above `POST` in `src/app/api/chat/route.ts`:

```ts
async function loadLeadSettings(adminClient: ReturnType<typeof createSupabaseAdminClient>, clinicId: string) {
  const { data, error } = await adminClient
    .from('clinic_settings')
    .select('key,value')
    .eq('clinic_id', clinicId)
    .like('key', 'lead_%')

  if (error) {
    throw error
  }

  return mapLeadAutomationSettings((data ?? []) as Array<{ key: string; value: string }>)
}
```

- [ ] **Step 3: Replace the prompt-only appointment flag with real automation**

In `POST`, after loading `historyMessages`, add:

```ts
const leadSettings = await loadLeadSettings(adminClient, conversation.clinic_id)
const transcriptLines = [
  ...(historyMessages ?? []).map((row) => `${row.role}: ${row.content}`),
  `user: ${message}`,
]
const automationMessageCount = (historyMessages?.length ?? 0) + 1

const extractedFields = extractAutomationFields(transcriptLines)

const { data: currentConversationStateRow } = await adminClient
  .from('conversations')
  .select('automation_state')
  .eq('id', conversation.id)
  .single()

let automationState = mergeAutomationState(
  currentConversationStateRow?.automation_state,
  extractedFields,
)
```

- [ ] **Step 4: Force safe fallback before assistant message save**

Replace:

```ts
const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I was unable to generate a response. Please try again.'
```

With:

```ts
const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I was unable to generate a response. Please try again.'
const finalResponse = buildSafeAssistantReply({
  aiResponse,
  supportLevel,
  latestUserMessage: message,
  fallbackMessage:
    aiProfile?.fallback_message ||
    "I'm not fully sure about that. Please contact the clinic directly so staff can help you correctly.",
})
```

Then save `finalResponse` instead of `aiResponse` in the assistant message insert, use `finalResponse` in unanswered detection, and return `finalResponse` in the response body.

- [ ] **Step 5: Add idempotent lead creation**

After assistant message save, add:

```ts
const lowerMessage = message.toLowerCase()

if (
  shouldCreateLead({
    settings: leadSettings,
    state: automationState,
    messageCount: automationMessageCount,
    latestUserMessage: lowerMessage,
    supportLevel,
  })
) {
  const automationKey = `${conversation.id}:lead:v1`

  const { data: lead, error: leadError } = await adminClient
    .from('leads')
    .upsert(
      {
        clinic_id: conversation.clinic_id,
        conversation_id: conversation.id,
        name: automationState.fields.name || 'Website visitor',
        phone: automationState.fields.phone,
        email: automationState.fields.email || null,
        question: message,
        source: 'chatbot',
        status: 'new',
        automation_key: automationKey,
      },
      { onConflict: 'clinic_id,automation_key' },
    )
    .select('id')
    .single()

  if (leadError) {
    throw leadError
  }

  automationState = {
    ...automationState,
    leadId: lead.id,
  }
}
```

- [ ] **Step 6: Add idempotent appointment-request creation**

Add immediately after lead creation:

```ts
if (shouldCreateAppointmentRequest(automationState)) {
  const automationKey = `${conversation.id}:appointment:v1`

  const { data: appointmentRequest, error: appointmentError } = await adminClient
    .from('appointment_requests')
    .upsert(
      {
        clinic_id: conversation.clinic_id,
        conversation_id: conversation.id,
        lead_id: automationState.leadId,
        name: automationState.fields.name || 'Website visitor',
        phone: automationState.fields.phone,
        email: automationState.fields.email || null,
        preferred_date: automationState.fields.preferredDate,
        preferred_time: automationState.fields.preferredTime,
        reason: automationState.fields.reason || message,
        preferred_doctor: automationState.fields.preferredDoctor || null,
        status: 'requested',
        source: 'chatbot',
        automation_key: automationKey,
      },
      { onConflict: 'clinic_id,automation_key' },
    )
    .select('id')
    .single()

  if (appointmentError) {
    throw appointmentError
  }

  automationState = {
    ...automationState,
    appointmentRequestId: appointmentRequest.id,
  }
}
```

- [ ] **Step 7: Update conversation metadata using the automation state**

Replace the current conversation update block with:

```ts
await adminClient
  .from('conversations')
  .update({
    message_count: messageCount ?? 0,
    last_message: finalResponse.slice(0, 200),
    last_message_at: new Date().toISOString(),
    appointment_requested: Boolean(automationState.appointmentRequestId),
    lead_captured: Boolean(automationState.leadId),
    automation_state: automationState,
    visitor_name: automationState.fields.name || null,
  })
  .eq('id', conversation.id)
```

- [ ] **Step 8: Return citation scores from real retrieval output**

Replace the citation map with:

```ts
const citations: CitationRow[] = knowledgeChunks.map((chunk) => {
  const sourceLabel =
    chunk.source_type === 'faq'
      ? `FAQ: ${chunk.knowledge_sources.title}`
      : chunk.source_type === 'manual_text'
        ? chunk.knowledge_sources.title
        : chunk.source_type === 'file_upload'
          ? chunk.file_name || chunk.knowledge_sources.title
          : chunk.page_title || chunk.knowledge_sources.title

  return {
    chunkId: chunk.id,
    sourceType: chunk.source_type,
    sourceTitle: sourceLabel,
    retrievalScore: chunk.retrieval_score ?? 0,
    scoreType: chunk.score_type ?? 'lexical',
  }
})
```

- [ ] **Step 9: Route test coverage**

Add one new test to `src/app/api/chat/route.test.ts`:

```ts
it('never accepts clinicId-only public widget access for automation paths', async () => {
  const { POST } = await import('@/app/api/chat/route')

  const request = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'book me tomorrow',
      clinicId: '11111111-1111-4111-8111-111111111111',
    }),
    headers: {
      'content-type': 'application/json',
    },
  })

  const response = await POST(request)
  expect(response.status).toBe(400)
})
```

---

## Task 4: Staff-Only Appointment Confirmation Flow

**Files:**
- Create: `src/app/api/appointment-requests/[id]/confirm/route.ts`
- Test: `src/app/api/appointment-requests/[id]/confirm/route.test.ts`
- Modify: `src/components/appointment-requests-page.tsx`

- [ ] **Step 1: Add the confirm route**

Create `src/app/api/appointment-requests/[id]/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { listClinicSettings } from '@/lib/clinics/settings'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const confirmSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  serviceId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  internalNote: z.string().trim().max(1000).nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const current = await getCurrentClinic(supabase, user)
  if (!current.clinic) {
    return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
  }

  const body = confirmSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', details: body.error.issues }, { status: 400 })
  }

  const { id } = await params
  const settings = await listClinicSettings(supabase, current.clinic.id)
  const slotDuration = Number(settings.find((row) => row.key === 'slot_duration')?.value || '30')
  const maxAdvanceBooking = Number(settings.find((row) => row.key === 'max_advance_booking')?.value || '60')
  const durationMinutes = body.data.durationMinutes ?? slotDuration

  const requestedDate = new Date(`${body.data.startDate}T00:00:00Z`)
  const maxDate = new Date()
  maxDate.setUTCDate(maxDate.getUTCDate() + maxAdvanceBooking)

  if (requestedDate > maxDate) {
    return NextResponse.json(
      { error: `Appointment cannot be confirmed more than ${maxAdvanceBooking} days in advance.` },
      { status: 400 },
    )
  }

  const admin = createSupabaseAdminClient()

  const { data, error } = await admin.rpc('confirm_appointment_request', {
    p_request_id: id,
    p_actor_user_id: user.id,
    p_start_date: body.data.startDate,
    p_start_time: body.data.startTime,
    p_duration_minutes: durationMinutes,
    p_service_id: body.data.serviceId ?? null,
    p_staff_id: body.data.staffId ?? null,
    p_internal_note: body.data.internalNote ?? null,
  })

  if (error) {
    const status = /duplicate key|double|conflict/i.test(error.message) ? 409 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Add confirm route tests**

Create `src/app/api/appointment-requests/[id]/confirm/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireAuthMock = vi.fn()
const getCurrentClinicMock = vi.fn()
const listClinicSettingsMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: requireAuthMock,
}))

vi.mock('@/lib/clinics/current', () => ({
  getCurrentClinic: getCurrentClinicMock,
}))

vi.mock('@/lib/clinics/settings', () => ({
  listClinicSettings: listClinicSettingsMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    rpc: rpcMock,
  }),
}))

describe('appointment confirm route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
      error: null,
    })
    getCurrentClinicMock.mockResolvedValue({
      clinic: { id: 'clinic-1' },
    })
    listClinicSettingsMock.mockResolvedValue([
      { key: 'slot_duration', value: '30' },
      { key: 'max_advance_booking', value: '60' },
    ])
  })

  it('rejects invalid request body', async () => {
    const { POST } = await import('@/app/api/appointment-requests/[id]/confirm/route')
    const request = new Request('http://localhost/api/appointment-requests/1/confirm', {
      method: 'POST',
      body: JSON.stringify({ startDate: 'bad-date' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })

    expect(response.status).toBe(400)
  })

  it('maps RPC conflicts to HTTP 409', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    })

    const { POST } = await import('@/app/api/appointment-requests/[id]/confirm/route')
    const request = new Request('http://localhost/api/appointment-requests/1/confirm', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-05-30',
        startTime: '10:30',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })

    expect(response.status).toBe(409)
  })
})
```

- [ ] **Step 3: Add a Confirm action in the appointment requests page**

In `src/components/appointment-requests-page.tsx`, add a confirm action that posts to:

```ts
await fetch(`/api/appointment-requests/${request.id}/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: request.preferred_date,
    startTime: request.preferred_time,
    serviceId: request.service_id ?? null,
    staffId: request.staff_id ?? null,
    internalNote: request.staff_notes ?? null,
  }),
})
```

UI rules:
- Disable the button while confirming.
- Show `409` as “That time was just taken. Please choose another time.”
- Refresh the request table after success.

---

## Task 5: Add Embedding Generation and Hybrid Retrieval

**Files:**
- Create: `supabase/functions/embed/index.ts`
- Create: `src/lib/knowledge/embeddings.ts`
- Create: `src/lib/knowledge/embeddings.test.ts`
- Modify: `src/lib/knowledge/jobs.ts`
- Modify: `src/lib/knowledge/sources.ts`
- Modify: `src/lib/knowledge/sources.test.ts`

- [ ] **Step 1: Add the Supabase Edge Function**

Create `supabase/functions/embed/index.ts`:

```ts
const session = new Supabase.ai.Session('gte-small')

Deno.serve(async (request) => {
  try {
    const body = await request.json()
    const inputs = Array.isArray(body?.inputs) ? body.inputs : []

    if (!inputs.length) {
      return Response.json({ error: 'inputs must be a non-empty array' }, { status: 400 })
    }

    const vectors: number[][] = []

    for (const input of inputs) {
      const value = typeof input === 'string' ? input.trim() : ''
      if (!value) {
        return Response.json({ error: 'all inputs must be non-empty strings' }, { status: 400 })
      }

      const vector = await session.run(value, { mean_pool: true, normalize: true })
      vectors.push(vector as number[])
    }

    return Response.json({
      model: 'gte-small',
      dimension: 384,
      vectors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate embeddings'
    return Response.json({ error: message }, { status: 500 })
  }
})
```

- [ ] **Step 2: Add a server-side embedding helper**

Create `src/lib/knowledge/embeddings.ts`:

```ts
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
```

- [ ] **Step 3: Update knowledge job processing so embeddings are optional, not required**

In `src/lib/knowledge/sources.ts`, add:

```ts
import { embedText384, embedTexts384, serializePgVector } from '@/lib/knowledge/embeddings'
```

Add this helper above `syncKnowledgeSourceContent`:

```ts
async function buildEmbeddingPayloadForChunks(chunks: Array<{ chunk_text: string; sort_order: number }>) {
  const response = await embedTexts384(chunks.map((chunk) => chunk.chunk_text))

  return chunks.flatMap((chunk, index) => {
    const vector = response.vectors[index]
    if (!Array.isArray(vector) || vector.length !== 384) {
      return []
    }

    return [{
      sort_order: chunk.sort_order,
      embedding_384: serializePgVector(vector),
    }]
  })
}
```

Then replace `syncKnowledgeSourceContent` with:

```ts
export async function syncKnowledgeSourceContent(
  supabase: SupabaseLikeClient,
  input: {
    sourceId: string
    title: string
    content: string
    sourceType: KnowledgeSourceType
    sourceUrl?: string | null
    pageTitle?: string | null
    sectionHeading?: string | null
    fileName?: string | null
    lastSyncedAt?: string
  },
) {
  const chunks = buildKnowledgeChunkPayload(input.content, {
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    pageTitle: input.pageTitle ?? input.title,
    sectionHeading: input.sectionHeading ?? null,
    fileName: input.fileName,
  })

  const status: KnowledgeSourceStatus = chunks.length > 0 ? 'trained' : 'failed'
  const failedReason = chunks.length > 0 ? null : 'No readable text found in source.'

  const { error } = await supabase.rpc('replace_knowledge_source_chunks', {
    p_source_id: input.sourceId,
    p_title: input.title,
    p_content: input.content,
    p_status: status,
    p_failed_reason: failedReason,
    p_chunks: chunks,
    p_last_synced_at: input.lastSyncedAt ?? new Date().toISOString(),
  })

  if (error) {
    throw new Error(error.message || 'Failed to sync knowledge source.')
  }

  if (chunks.length === 0) {
    return
  }

  try {
    const embeddings = await buildEmbeddingPayloadForChunks(chunks)
    if (embeddings.length > 0) {
      await supabase.rpc('update_knowledge_chunk_embeddings_384', {
        p_source_id: input.sourceId,
        p_embeddings: embeddings,
        p_embedding_model: 'gte-small',
      })
    }
  } catch (embeddingError) {
    console.warn('Embedding generation failed, keeping lexical search active:', embeddingError)
  }
}
```

- [ ] **Step 4: Change chunking to match the MVP target better**

Replace:

```ts
const CHUNK_CHARACTER_LIMIT = 1200
```

With:

```ts
const CHUNK_CHARACTER_LIMIT = 4200
const CHUNK_OVERLAP_CHARACTERS = 600
```

Then replace `splitKnowledgeContentIntoChunks` with:

```ts
export function splitKnowledgeContentIntoChunks(text: string) {
  const clean = text.trim()
  if (!clean) return []

  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= CHUNK_CHARACTER_LIMIT) {
      current = candidate
      continue
    }

    if (current) {
      chunks.push(current)
      const overlap = current.slice(-CHUNK_OVERLAP_CHARACTERS).trim()
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph
      continue
    }

    let start = 0
    while (start < paragraph.length) {
      const end = Math.min(start + CHUNK_CHARACTER_LIMIT, paragraph.length)
      const piece = paragraph.slice(start, end).trim()
      if (piece) chunks.push(piece)
      if (end >= paragraph.length) break
      start = Math.max(0, end - CHUNK_OVERLAP_CHARACTERS)
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}
```

- [ ] **Step 5: Add hybrid retrieval**

Replace `searchKnowledgeChunks` in `src/lib/knowledge/sources.ts` with:

```ts
function scoreLexicalChunk(row: KnowledgeSourceChunkSearchRow, keywords: string[]) {
  return computeChunkScore(row, keywords)
}

function mergeHybridKnowledgeResults(
  lexicalRows: KnowledgeSourceChunkSearchRow[],
  vectorRows: KnowledgeSourceChunkSearchRow[],
  limit: number,
) {
  const merged = new Map<string, KnowledgeSourceChunkSearchRow>()

  for (const row of lexicalRows) {
    merged.set(row.id, {
      ...row,
      retrieval_score: row.retrieval_score ?? 0.55,
      score_type: 'lexical',
    })
  }

  for (const row of vectorRows) {
    const existing = merged.get(row.id)
    if (!existing) {
      merged.set(row.id, row)
      continue
    }

    merged.set(row.id, {
      ...existing,
      retrieval_score: Math.max(existing.retrieval_score ?? 0, row.retrieval_score ?? 0),
      score_type: 'hybrid',
    })
  }

  return [...merged.values()]
    .sort((left, right) => (right.retrieval_score ?? 0) - (left.retrieval_score ?? 0))
    .slice(0, limit)
}

export async function searchKnowledgeChunks(
  supabase: SupabaseLikeClient,
  clinicId: string,
  query: string,
  options?: {
    limit?: number
    sourceTypes?: KnowledgeSourceType[]
  },
) {
  const keywords = normalizeSearchTerms(query)
  if (keywords.length === 0) {
    return [] as KnowledgeSourceChunkSearchRow[]
  }

  let searchQuery = supabase
    .from('knowledge_chunks')
    .select(chunkSelect)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .eq('knowledge_sources.status', 'trained')
    .eq('knowledge_sources.is_active', true)
    .textSearch('search_document', keywords.join(' '), {
      config: 'simple',
      type: 'plain',
    })
    .order('updated_at', { ascending: false })
    .limit(Math.max((options?.limit ?? 5) * 4, 8))

  if (options?.sourceTypes?.length) {
    searchQuery = searchQuery.in('source_type', options.sourceTypes)
  }

  const { data, error } = await searchQuery
  if (error) {
    throw error
  }

  const lexicalRows = ((data ?? []) as KnowledgeSourceChunkSearchRow[])
    .map((row) => ({
      ...row,
      retrieval_score: Math.min(0.89, 0.45 + scoreLexicalChunk(row, keywords) / 1000),
      score_type: 'lexical' as const,
      source_type: row.source_type,
    }))
    .sort((left, right) => (right.retrieval_score ?? 0) - (left.retrieval_score ?? 0))

  let vectorRows: KnowledgeSourceChunkSearchRow[] = []

  try {
    const vector = await embedText384(query)
    if (vector?.length) {
      const { data: vectorData, error: vectorError } = await supabase.rpc('match_knowledge_chunks_384', {
        p_clinic_id: clinicId,
        p_query_embedding: serializePgVector(vector),
        p_match_count: Math.max((options?.limit ?? 5) * 2, 8),
        p_match_threshold: 0.72,
      })

      if (vectorError) throw vectorError

      vectorRows = ((vectorData ?? []) as any[]).map((row) => ({
        ...row,
        knowledge_sources: row.knowledge_sources,
      }))
    }
  } catch (error) {
    console.warn('Vector retrieval failed, falling back to lexical search:', error)
  }

  return mergeHybridKnowledgeResults(
    lexicalRows,
    vectorRows,
    options?.limit ?? 5,
  )
}
```

- [ ] **Step 6: Add embedding tests**

Create `src/lib/knowledge/embeddings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { serializePgVector } from '@/lib/knowledge/embeddings'

describe('knowledge embeddings helpers', () => {
  it('serializes vectors for pgvector RPC input', () => {
    expect(serializePgVector([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]')
  })
})
```

Update `src/lib/knowledge/sources.test.ts` chunk test:

```ts
expect(chunks.every((chunk) => chunk.length <= 4200)).toBe(true)
```

---

## Task 6: Keep Refresh Failures from Killing Existing Trained Search

**Files:**
- Modify: `src/lib/knowledge/jobs.ts`

- [ ] **Step 1: Preserve the old trained source if refresh work fails**

In `src/lib/knowledge/jobs.ts`, replace `updateSourceFailure` with:

```ts
async function updateSourceFailure(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
  sourceId: string | null,
  message: string,
) {
  if (!sourceId) return

  const source = await getKnowledgeSourceForClinic(admin, clinicId, sourceId)
  if (!source) return

  const preserveTrainedState = source.status === 'trained' && source.chunk_count > 0

  await updateKnowledgeSourceDraft(admin, clinicId, sourceId, {
    status: preserveTrainedState ? 'trained' : 'failed',
    failedReason: message,
  })
}
```

This keeps old trained chunks searchable when a refresh fails after the source already worked before.

---

## Task 7: Live RLS and Route Isolation Verification

**Files:**
- Create: `scripts/security/verify-live-rls.sh`

- [ ] **Step 1: Add a live verification script**

Create `scripts/security/verify-live-rls.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?Missing SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Missing SUPABASE_ANON_KEY}"
: "${CLINIC_A_JWT:?Missing CLINIC_A_JWT}"
: "${CLINIC_B_ID:?Missing CLINIC_B_ID}"
: "${CLINIC_B_LEAD_ID:?Missing CLINIC_B_LEAD_ID}"

echo "1. Read leads as clinic A user"
curl -sS \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLINIC_A_JWT" \
  "$SUPABASE_URL/rest/v1/leads?select=id,clinic_id,status" \
  | tee /tmp/rls-leads-read.json

echo
echo "2. Try to update a clinic B lead as clinic A user"
curl -sS \
  -X PATCH \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLINIC_A_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"clinic_id\":\"$CLINIC_B_ID\"}" \
  "$SUPABASE_URL/rest/v1/leads?id=eq.$CLINIC_B_LEAD_ID&select=id,clinic_id" \
  | tee /tmp/rls-leads-patch.json

echo
echo "3. Try to call dashboard RPC for clinic B"
curl -sS \
  -X POST \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLINIC_A_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"p_clinic_id\":\"$CLINIC_B_ID\"}" \
  "$SUPABASE_URL/rest/v1/rpc/get_dashboard_kpis" \
  | tee /tmp/rls-dashboard.json

echo
echo "Expected:"
echo "- read output shows only clinic A rows"
echo "- patch output is [] or a permission error"
echo "- dashboard output is [] or permission denied"
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x scripts/security/verify-live-rls.sh
```

- [ ] **Step 3: Run the live checks**

Run:

```bash
scripts/security/verify-live-rls.sh
```

---

## Task 8: Deployment and Validation Order

- [ ] **Step 1: Deploy the embedding function**

Run:

```bash
supabase functions deploy embed
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/chat/automation.test.ts src/lib/knowledge/embeddings.test.ts src/lib/knowledge/sources.test.ts src/app/api/chat/route.test.ts src/app/api/appointment-requests/[id]/confirm/route.test.ts
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npx tsc --noEmit --pretty false
```

- [ ] **Step 4: Run live RLS verification**

Run:

```bash
scripts/security/verify-live-rls.sh
```

---

## Edge Cases Checklist

- Retry of the same chat request must not create duplicate leads
- Retry of the same confirm click must not create duplicate appointments
- Vector generation failure must not break lexical retrieval
- Weak support answers must fall back instead of inventing details
- Staff and service IDs must belong to the same clinic before confirmation
- Confirm route must reject dates beyond `max_advance_booking`
- Public widget path must keep resolving `clinic_id` on the server only
- Old trained knowledge must stay active if a refresh later fails

---

## Validation Checklist

- [ ] Widget chat creates a lead only after the trigger rule is met
- [ ] Widget chat creates an appointment request only after phone, date, and time are present
- [ ] The same conversation cannot create duplicate lead rows on refresh/retry
- [ ] Staff can confirm an appointment request into `appointments`
- [ ] Double confirm returns conflict instead of duplicate rows
- [ ] Search still works when embeddings are missing
- [ ] Search improves when embeddings are present
- [ ] Clinic A cannot read or update Clinic B rows through REST
- [ ] Dashboard RPC does not leak cross-clinic data

---

## Confidence Rating

- Chat automation plan: **high**
- Appointment confirmation plan: **high**
- Hybrid retrieval plan: **medium-high**
- Live RLS verification plan: **high**

Plan complete and saved to `docs/superpowers/plans/2026-05-16-chat-appointments-embeddings-rls.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
