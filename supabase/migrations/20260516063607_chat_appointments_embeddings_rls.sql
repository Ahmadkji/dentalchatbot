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
  using hnsw (embedding_384 extensions.vector_cosine_ops)
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
set search_path = public, extensions
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
