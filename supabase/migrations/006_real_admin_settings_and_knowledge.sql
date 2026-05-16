-- =============================================
-- Real admin settings, lead custom fields, and knowledge sources
-- =============================================

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  key text not null check (char_length(trim(key)) between 2 and 80),
  value text not null default '',
  category text not null check (char_length(trim(category)) between 2 and 80),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, key)
);

create table if not exists public.lead_custom_fields (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 2 and 120),
  field_type text not null check (field_type in ('text', 'textarea', 'select', 'number', 'email', 'tel')),
  required boolean not null default false,
  options text[] not null default '{}',
  placeholder text,
  sort_order int not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 200),
  type text not null check (type in ('manual_text', 'website', 'file')),
  content text not null default '',
  source_url text,
  file_name text,
  file_type text,
  status text not null default 'processing' check (status in ('processing', 'trained', 'failed', 'needs_refresh')),
  chunk_count int not null default 0 check (chunk_count >= 0),
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_url is null or source_url ~ '^https?://[^[:space:]]+$')
);

create unique index if not exists idx_knowledge_sources_clinic_url
  on public.knowledge_sources (clinic_id, type, source_url)
  where source_url is not null;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  content text not null,
  sort_order int not null check (sort_order > 0),
  token_estimate int not null check (token_estimate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, sort_order)
);

create index if not exists idx_clinic_settings_clinic_category on public.clinic_settings(clinic_id, category, key);
create index if not exists idx_lead_custom_fields_clinic_order on public.lead_custom_fields(clinic_id, sort_order);
create index if not exists idx_knowledge_sources_clinic_status on public.knowledge_sources(clinic_id, status, updated_at desc);
create index if not exists idx_knowledge_chunks_source_order on public.knowledge_chunks(source_id, sort_order);

drop trigger if exists clinic_settings_updated_at on public.clinic_settings;
create trigger clinic_settings_updated_at
  before update on public.clinic_settings
  for each row execute function public.set_updated_at();

drop trigger if exists lead_custom_fields_updated_at on public.lead_custom_fields;
create trigger lead_custom_fields_updated_at
  before update on public.lead_custom_fields
  for each row execute function public.set_updated_at();

drop trigger if exists knowledge_sources_updated_at on public.knowledge_sources;
create trigger knowledge_sources_updated_at
  before update on public.knowledge_sources
  for each row execute function public.set_updated_at();

drop trigger if exists knowledge_chunks_updated_at on public.knowledge_chunks;
create trigger knowledge_chunks_updated_at
  before update on public.knowledge_chunks
  for each row execute function public.set_updated_at();

create or replace function public.seed_clinic_settings(p_clinic_id uuid)
returns void
language sql
set search_path = public
as $$
  insert into public.clinic_settings (clinic_id, key, value, category, description)
  select
    p_clinic_id,
    defaults.key,
    defaults.value,
    defaults.category,
    defaults.description
  from (
    values
      ('ai_personality', 'friendly_professional', 'ai', 'Controls the default AI communication style.'),
      ('after_hours_message', 'We are currently closed. Leave a message and the clinic will reply when it opens.', 'automation', 'Shown when the chatbot engages after clinic hours.'),
      ('auto_reply', 'true', 'automation', 'Allows the assistant to answer patient questions automatically.'),
      ('faq_enabled', 'true', 'automation', 'Lets the bot use FAQ-style responses when suitable.'),
      ('appointment_buffer', '15', 'appointments', 'Minutes to leave between appointments.'),
      ('max_advance_booking', '60', 'appointments', 'Maximum number of days patients can request in advance.'),
      ('cancellation_policy', 'Please contact the clinic directly to cancel or reschedule an appointment.', 'appointments', 'Displayed when a patient asks about cancelling or rescheduling.'),
      ('slot_duration', '30', 'appointments', 'Default appointment slot duration in minutes.'),
      ('greeting_message', 'Hi! How can I help you today?', 'communication', 'Opening greeting for manual support moments.'),
      ('closing_message', 'Please contact the clinic directly if you need anything else.', 'communication', 'Closing fallback message when the bot cannot help further.'),
      ('emergency_response', 'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, contact the clinic or emergency services immediately.', 'communication', 'Safety response for urgent patient situations.'),
      ('parking_info', '', 'communication', 'Optional parking or arrival notes for patients.'),
      ('google_maps_url', '', 'communication', 'Optional Google Maps link for the clinic location.'),
      ('bot_disabled_fields', '[]', 'communication', 'Clinic profile fields hidden from chatbot answers.'),
      ('lead_collection_enabled', 'true', 'lead-collection', 'Enable visitor lead capture in the chatbot.'),
      ('lead_collect_email', 'true', 'lead-collection', 'Collect patient email addresses during lead capture.'),
      ('lead_collect_name', 'true', 'lead-collection', 'Collect patient names during lead capture.'),
      ('lead_collect_phone', 'true', 'lead-collection', 'Collect patient phone numbers during lead capture.'),
      ('lead_trigger_mode', 'interest', 'lead-collection', 'Defines when lead capture should begin.'),
      ('lead_trigger_message_count', '1', 'lead-collection', 'How many messages before lead capture can start.'),
      ('lead_trigger_keywords', 'pricing, demo, consultation, quote, appointment, contact, schedule, buy, purchase', 'lead-collection', 'Keywords that can trigger lead capture.'),
      ('lead_notifications_enabled', 'true', 'lead-collection', 'Send notifications when a new lead is captured.'),
      ('lead_notification_emails', '', 'lead-collection', 'Comma-separated email list for lead alerts.'),
      ('lead_auto_escalation', 'false', 'lead-collection', 'Escalate leads automatically when the trigger conditions are met.')
  ) as defaults(key, value, category, description)
  on conflict (clinic_id, key) do nothing;
$$;

create or replace function public.seed_clinic_settings_for_clinic()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.seed_clinic_settings(new.id);
  return new;
end;
$$;

drop trigger if exists clinics_seed_clinic_settings on public.clinics;
create trigger clinics_seed_clinic_settings
  after insert on public.clinics
  for each row execute function public.seed_clinic_settings_for_clinic();

create or replace function public.replace_knowledge_source_chunks(
  p_source_id uuid,
  p_title text,
  p_content text,
  p_status text,
  p_error_message text,
  p_chunks jsonb,
  p_last_synced_at timestamptz default now()
)
returns public.knowledge_sources
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.knowledge_sources;
  v_chunk jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id;

  if v_source.id is null then
    raise exception 'Knowledge source not found.';
  end if;

  if not public.has_clinic_role(v_source.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to manage this knowledge source.';
  end if;

  if jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'Knowledge chunks payload must be an array.';
  end if;

  update public.knowledge_sources
  set title = trim(p_title),
      content = p_content,
      status = p_status,
      error_message = p_error_message,
      last_synced_at = p_last_synced_at,
      chunk_count = jsonb_array_length(p_chunks)
  where id = p_source_id;

  delete from public.knowledge_chunks
  where source_id = p_source_id;

  for v_chunk in
    select value
    from jsonb_array_elements(p_chunks)
  loop
    insert into public.knowledge_chunks (
      clinic_id,
      source_id,
      content,
      sort_order,
      token_estimate
    )
    values (
      v_source.clinic_id,
      p_source_id,
      coalesce(v_chunk ->> 'content', ''),
      (v_chunk ->> 'sort_order')::int,
      coalesce((v_chunk ->> 'token_estimate')::int, 0)
    );
  end loop;

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id;

  return v_source;
end;
$$;

alter table public.clinic_settings enable row level security;
alter table public.lead_custom_fields enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "Clinic members can read clinic settings" on public.clinic_settings;
drop policy if exists "Owners and admins can manage clinic settings" on public.clinic_settings;

create policy "Clinic members can read clinic settings"
  on public.clinic_settings
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage clinic settings"
  on public.clinic_settings
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read lead custom fields" on public.lead_custom_fields;
drop policy if exists "Owners and admins can manage lead custom fields" on public.lead_custom_fields;

create policy "Clinic members can read lead custom fields"
  on public.lead_custom_fields
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage lead custom fields"
  on public.lead_custom_fields
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read knowledge sources" on public.knowledge_sources;
drop policy if exists "Owners and admins can manage knowledge sources" on public.knowledge_sources;

create policy "Clinic members can read knowledge sources"
  on public.knowledge_sources
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage knowledge sources"
  on public.knowledge_sources
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read knowledge chunks" on public.knowledge_chunks;
drop policy if exists "Owners and admins can manage knowledge chunks" on public.knowledge_chunks;

create policy "Clinic members can read knowledge chunks"
  on public.knowledge_chunks
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage knowledge chunks"
  on public.knowledge_chunks
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

select public.seed_clinic_settings(id)
from public.clinics;

revoke all on public.clinic_settings from anon;
revoke all on public.lead_custom_fields from anon;
revoke all on public.knowledge_sources from anon;
revoke all on public.knowledge_chunks from anon;

grant select, insert, update, delete on public.clinic_settings to authenticated;
grant select, insert, update, delete on public.lead_custom_fields to authenticated;
grant select, insert, update, delete on public.knowledge_sources to authenticated;
grant select, insert, update, delete on public.knowledge_chunks to authenticated;

revoke all on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) to authenticated;
