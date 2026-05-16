-- =============================================
-- Feature 3: clinic website import draft/review/approval flow
-- =============================================

create table if not exists public.clinic_import_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  website_url text not null check (website_url ~ '^https?://[^[:space:]]+$'),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'failed', 'cancelled')),
  fetch_status text not null default 'fetched' check (fetch_status in ('pending', 'fetched', 'failed')),
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz
);

create table if not exists public.clinic_import_detected_fields (
  id uuid primary key default gen_random_uuid(),
  import_session_id uuid not null references public.clinic_import_sessions(id) on delete cascade,
  field_type text not null check (field_type in ('name', 'phone', 'whatsapp', 'address', 'city', 'opening_hours', 'pricing_notes', 'emergency_instructions')),
  detected_value text not null,
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$'),
  source_text_snippet text not null,
  confidence numeric(3, 2) not null check (confidence >= 0 and confidence <= 1),
  approved boolean not null default false,
  approved_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinic_import_sessions_clinic_created
  on public.clinic_import_sessions(clinic_id, created_at desc);

create index if not exists idx_clinic_import_detected_fields_session
  on public.clinic_import_detected_fields(import_session_id, created_at asc);

drop trigger if exists clinic_import_detected_fields_updated_at on public.clinic_import_detected_fields;
create trigger clinic_import_detected_fields_updated_at
  before update on public.clinic_import_detected_fields
  for each row execute function public.set_updated_at();

create or replace function public.approve_clinic_import_session(
  p_session_id uuid,
  p_approvals jsonb,
  p_clinic_update jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.clinic_import_sessions%rowtype;
  v_clinic_update jsonb := coalesce(p_clinic_update, '{}'::jsonb);
  v_approval jsonb;
  v_field_id uuid;
  v_approved boolean;
  v_approved_value text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if jsonb_typeof(p_approvals) <> 'array' or jsonb_array_length(p_approvals) = 0 then
    raise exception 'Import approvals payload must include at least one field.';
  end if;

  if jsonb_typeof(v_clinic_update) <> 'object' then
    raise exception 'Clinic import update payload must be an object.';
  end if;

  select *
  into v_session
  from public.clinic_import_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Import session not found.';
  end if;

  if not public.has_clinic_role(v_session.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to approve clinic imports.';
  end if;

  if v_session.status = 'approved' then
    raise exception 'This import session has already been approved.';
  end if;

  if v_session.status = 'cancelled' then
    raise exception 'This import session was cancelled.';
  end if;

  for v_approval in
    select value
    from jsonb_array_elements(p_approvals)
  loop
    v_field_id := nullif(v_approval ->> 'field_id', '')::uuid;
    v_approved := coalesce((v_approval ->> 'approved')::boolean, false);
    v_approved_value := nullif(trim(coalesce(v_approval ->> 'approved_value', '')), '');

    if v_field_id is null then
      raise exception 'Each approval must include a field_id.';
    end if;

    update public.clinic_import_detected_fields
    set
      approved = v_approved,
      approved_value = case
        when v_approved then coalesce(v_approved_value, detected_value)
        else null
      end
    where id = v_field_id
      and import_session_id = p_session_id;

    if not found then
      raise exception 'Import field does not belong to this session.';
    end if;
  end loop;

  update public.clinics
  set
    name = case when v_clinic_update ? 'name' then nullif(trim(v_clinic_update ->> 'name'), '') else name end,
    phone = case when v_clinic_update ? 'phone' then nullif(trim(v_clinic_update ->> 'phone'), '') else phone end,
    whatsapp = case when v_clinic_update ? 'whatsapp' then nullif(trim(v_clinic_update ->> 'whatsapp'), '') else whatsapp end,
    address = case when v_clinic_update ? 'address' then nullif(trim(v_clinic_update ->> 'address'), '') else address end,
    city = case when v_clinic_update ? 'city' then nullif(trim(v_clinic_update ->> 'city'), '') else city end,
    pricing_notes = case when v_clinic_update ? 'pricing_notes' then nullif(trim(v_clinic_update ->> 'pricing_notes'), '') else pricing_notes end,
    emergency_instructions = case when v_clinic_update ? 'emergency_instructions' then nullif(trim(v_clinic_update ->> 'emergency_instructions'), '') else emergency_instructions end,
    updated_at = now()
  where id = v_session.clinic_id;

  update public.clinic_import_sessions
  set
    status = 'approved',
    reviewed_at = now(),
    approved_at = now(),
    error_message = p_error_message
  where id = p_session_id;

  insert into public.clinic_profile_audit_logs (
    clinic_id,
    actor_user_id,
    event,
    entity_type,
    metadata
  )
  values (
    v_session.clinic_id,
    v_user_id,
    'clinic_import_approved',
    'clinic_profile',
    jsonb_build_object(
      'import_session_id', p_session_id,
      'approved_field_ids',
      (
        select coalesce(jsonb_agg(value ->> 'field_id'), '[]'::jsonb)
        from jsonb_array_elements(p_approvals) value
        where coalesce((value ->> 'approved')::boolean, false)
      )
    )
  );

  perform public.refresh_clinic_profile_status(v_session.clinic_id);
end;
$$;

alter table public.clinic_import_sessions enable row level security;
alter table public.clinic_import_detected_fields enable row level security;

drop policy if exists "Clinic members can read clinic import sessions" on public.clinic_import_sessions;
drop policy if exists "Owners and admins can manage clinic import sessions" on public.clinic_import_sessions;

create policy "Clinic members can read clinic import sessions"
  on public.clinic_import_sessions
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage clinic import sessions"
  on public.clinic_import_sessions
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read clinic import detected fields" on public.clinic_import_detected_fields;
drop policy if exists "Owners and admins can manage clinic import detected fields" on public.clinic_import_detected_fields;

create policy "Clinic members can read clinic import detected fields"
  on public.clinic_import_detected_fields
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clinic_import_sessions cis
      where cis.id = clinic_import_detected_fields.import_session_id
        and public.is_clinic_member(cis.clinic_id)
    )
  );

create policy "Owners and admins can manage clinic import detected fields"
  on public.clinic_import_detected_fields
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.clinic_import_sessions cis
      where cis.id = clinic_import_detected_fields.import_session_id
        and public.has_clinic_role(cis.clinic_id, array['owner', 'admin'])
    )
  )
  with check (
    exists (
      select 1
      from public.clinic_import_sessions cis
      where cis.id = clinic_import_detected_fields.import_session_id
        and public.has_clinic_role(cis.clinic_id, array['owner', 'admin'])
    )
  );

revoke all on public.clinic_import_sessions from anon;
revoke all on public.clinic_import_detected_fields from anon;
revoke all on function public.approve_clinic_import_session(uuid, jsonb, jsonb, text) from public;

grant select, insert, update, delete on public.clinic_import_sessions to authenticated;
grant select, insert, update, delete on public.clinic_import_detected_fields to authenticated;
grant execute on function public.approve_clinic_import_session(uuid, jsonb, jsonb, text) to authenticated;
