-- =============================================
-- MVP production schema contracts
--
-- This migration fills the real-data gaps found in the MVP checklist:
-- - confirmed appointments are separate from appointment requests
-- - lead and appointment statuses match the production workflow
-- - lead duplicate prevention exists at the database layer
-- - staff/resources can be attached to appointments
-- - dashboard KPIs can be calculated from trusted clinic-owned rows
-- - RLS update policies keep clinic_id tenant-safe after updates
-- =============================================

-- ---------------------------------------------
-- Shared normalization helpers
-- ---------------------------------------------
create or replace function public.normalize_phone_digits(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '');
$$;

create or replace function public.normalize_email_value(p_value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(p_value, ''))), '');
$$;

-- ---------------------------------------------
-- Leads: production fields, statuses, validation, duplicate prevention
-- ---------------------------------------------
alter table public.leads
  add column if not exists email text,
  add column if not exists closed_reason text,
  add column if not exists last_contacted_at timestamptz;

update public.leads
set status = case
  when status = 'qualified' then 'contacted'
  when status = 'lost' then 'closed'
  when status in ('new', 'contacted', 'booked', 'closed', 'spam') then status
  else 'new'
end
where status not in ('new', 'contacted', 'booked', 'closed', 'spam');

alter table public.leads
  alter column status set default 'new',
  drop constraint if exists leads_status_check,
  add constraint leads_status_check
    check (status in ('new', 'contacted', 'booked', 'closed', 'spam'));

alter table public.leads
  drop constraint if exists leads_phone_format_check,
  add constraint leads_phone_format_check
    check (
      public.normalize_phone_digits(phone) is not null
      and char_length(public.normalize_phone_digits(phone)) between 7 and 15
    ) not valid,
  drop constraint if exists leads_email_format_check,
  add constraint leads_email_format_check
    check (
      email is null
      or trim(email) = ''
      or lower(trim(email)) ~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
    ) not valid;

create index if not exists idx_leads_clinic_created_at
  on public.leads(clinic_id, created_at desc);

create index if not exists idx_leads_clinic_email
  on public.leads(clinic_id, public.normalize_email_value(email))
  where email is not null and trim(email) <> '';

create index if not exists idx_leads_clinic_phone_digits
  on public.leads(clinic_id, public.normalize_phone_digits(phone))
  where public.normalize_phone_digits(phone) is not null;

create or replace function public.prevent_duplicate_active_lead_contact()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_phone text := public.normalize_phone_digits(new.phone);
  v_email text := public.normalize_email_value(new.email);
begin
  if new.status <> 'spam' then
    if v_phone is not null and exists (
      select 1
      from public.leads existing
      where existing.clinic_id = new.clinic_id
        and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and existing.status <> 'spam'
        and public.normalize_phone_digits(existing.phone) = v_phone
    ) then
      raise exception 'Duplicate lead phone for this clinic.'
        using errcode = '23505';
    end if;

    if v_email is not null and exists (
      select 1
      from public.leads existing
      where existing.clinic_id = new.clinic_id
        and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and existing.status <> 'spam'
        and public.normalize_email_value(existing.email) = v_email
    ) then
      raise exception 'Duplicate lead email for this clinic.'
        using errcode = '23505';
    end if;
  end if;

  if new.status = 'contacted' and new.last_contacted_at is null then
    new.last_contacted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists leads_prevent_duplicate_contact on public.leads;
create trigger leads_prevent_duplicate_contact
  before insert or update of clinic_id, phone, email, status
  on public.leads
  for each row execute function public.prevent_duplicate_active_lead_contact();

-- ---------------------------------------------
-- Staff/resources for appointment ownership
-- ---------------------------------------------
create table if not exists public.clinic_staff (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 160),
  role text not null default 'staff'
    check (role in ('doctor', 'hygienist', 'assistant', 'receptionist', 'staff')),
  title text,
  phone text,
  email text,
  booking_enabled boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinic_staff_clinic_active
  on public.clinic_staff(clinic_id, is_active, booking_enabled, sort_order);

create unique index if not exists idx_clinic_staff_clinic_lower_name
  on public.clinic_staff(clinic_id, lower(full_name));

drop trigger if exists clinic_staff_updated_at on public.clinic_staff;
create trigger clinic_staff_updated_at
  before update on public.clinic_staff
  for each row execute function public.set_updated_at();

alter table public.clinic_staff enable row level security;

drop policy if exists "Service role full access on clinic_staff" on public.clinic_staff;
create policy "Service role full access on clinic_staff"
  on public.clinic_staff for all
  to service_role
  using (true) with check (true);

drop policy if exists "Clinic members can read clinic staff" on public.clinic_staff;
create policy "Clinic members can read clinic staff"
  on public.clinic_staff for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

drop policy if exists "Owners and admins can manage clinic staff" on public.clinic_staff;
create policy "Owners and admins can manage clinic staff"
  on public.clinic_staff for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

-- ---------------------------------------------
-- Appointment requests: match request workflow
-- ---------------------------------------------
alter table public.appointment_requests
  add column if not exists email text,
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists staff_id uuid references public.clinic_staff(id) on delete set null,
  add column if not exists requested_timezone text,
  add column if not exists staff_notes text;

update public.appointment_requests
set status = case
  when status in ('pending', 'rescheduled') then 'requested'
  when status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show') then status
  else 'requested'
end
where status not in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show');

alter table public.appointment_requests
  alter column status set default 'requested',
  drop constraint if exists appointment_requests_status_check,
  add constraint appointment_requests_status_check
    check (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show'));

alter table public.appointment_requests
  drop constraint if exists appointment_requests_phone_format_check,
  add constraint appointment_requests_phone_format_check
    check (
      public.normalize_phone_digits(phone) is not null
      and char_length(public.normalize_phone_digits(phone)) between 7 and 15
    ) not valid,
  drop constraint if exists appointment_requests_email_format_check,
  add constraint appointment_requests_email_format_check
    check (
      email is null
      or trim(email) = ''
      or lower(trim(email)) ~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
    ) not valid;

create index if not exists idx_appointment_requests_clinic_date_status
  on public.appointment_requests(clinic_id, preferred_date, status);

create index if not exists idx_appointment_requests_service_id
  on public.appointment_requests(service_id)
  where service_id is not null;

create index if not exists idx_appointment_requests_staff_id
  on public.appointment_requests(staff_id)
  where staff_id is not null;

-- ---------------------------------------------
-- Confirmed appointments: separate from requests
-- ---------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_request_id uuid unique references public.appointment_requests(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  staff_id uuid references public.clinic_staff(id) on delete set null,
  patient_name text not null check (char_length(trim(patient_name)) between 1 and 160),
  patient_phone text not null,
  patient_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status text not null default 'confirmed'
    check (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  source text not null default 'staff'
    check (source in ('staff', 'chatbot', 'widget', 'phone', 'import')),
  cancellation_reason text,
  internal_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_window_check check (ends_at > starts_at),
  constraint appointments_phone_format_check check (
    public.normalize_phone_digits(patient_phone) is not null
    and char_length(public.normalize_phone_digits(patient_phone)) between 7 and 15
  ),
  constraint appointments_email_format_check check (
    patient_email is null
    or trim(patient_email) = ''
    or lower(trim(patient_email)) ~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
  )
);

create index if not exists idx_appointments_clinic_starts_at
  on public.appointments(clinic_id, starts_at desc);

create index if not exists idx_appointments_clinic_status
  on public.appointments(clinic_id, status, starts_at desc);

create index if not exists idx_appointments_request_id
  on public.appointments(appointment_request_id)
  where appointment_request_id is not null;

create unique index if not exists idx_appointments_staff_time_no_double_book
  on public.appointments(clinic_id, staff_id, starts_at)
  where staff_id is not null and status in ('requested', 'confirmed');

create unique index if not exists idx_appointments_clinic_time_no_staff_no_double_book
  on public.appointments(clinic_id, starts_at)
  where staff_id is null and status in ('requested', 'confirmed');

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists "Service role full access on appointments" on public.appointments;
create policy "Service role full access on appointments"
  on public.appointments for all
  to service_role
  using (true) with check (true);

drop policy if exists "Clinic members can read appointments" on public.appointments;
create policy "Clinic members can read appointments"
  on public.appointments for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can insert appointments" on public.appointments;
create policy "Clinic members can insert appointments"
  on public.appointments for insert
  to authenticated
  with check (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can update appointments" on public.appointments;
create policy "Clinic members can update appointments"
  on public.appointments for update
  to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can delete appointments" on public.appointments;
create policy "Clinic members can delete appointments"
  on public.appointments for delete
  to authenticated
  using (public.is_clinic_member(clinic_id));

-- ---------------------------------------------
-- Conversation message metadata for dashboard service/intent analytics
-- ---------------------------------------------
alter table public.conversation_messages
  add column if not exists clinic_id uuid references public.clinics(id) on delete cascade,
  add column if not exists intent text,
  add column if not exists service_id uuid references public.services(id) on delete set null;

update public.conversation_messages cm
set clinic_id = c.clinic_id
from public.conversations c
where cm.conversation_id = c.id
  and cm.clinic_id is null;

create index if not exists idx_conversation_messages_clinic_created
  on public.conversation_messages(clinic_id, created_at desc)
  where clinic_id is not null;

create index if not exists idx_conversation_messages_clinic_service
  on public.conversation_messages(clinic_id, service_id)
  where service_id is not null;

create or replace function public.set_conversation_message_clinic_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.clinic_id is null then
    select c.clinic_id
    into new.clinic_id
    from public.conversations c
    where c.id = new.conversation_id;
  end if;

  return new;
end;
$$;

drop trigger if exists conversation_messages_set_clinic_id on public.conversation_messages;
create trigger conversation_messages_set_clinic_id
  before insert or update of conversation_id, clinic_id
  on public.conversation_messages
  for each row execute function public.set_conversation_message_clinic_id();

-- ---------------------------------------------
-- Tenant-safe update policies
-- ---------------------------------------------
drop policy if exists "Clinic members can update conversations" on public.conversations;
create policy "Clinic members can update conversations"
  on public.conversations for update
  to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can update leads" on public.leads;
create policy "Clinic members can update leads"
  on public.leads for update
  to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can update appointment requests" on public.appointment_requests;
create policy "Clinic members can update appointment requests"
  on public.appointment_requests for update
  to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can update unanswered questions" on public.unanswered_questions;
create policy "Clinic members can update unanswered questions"
  on public.unanswered_questions for update
  to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can insert messages" on public.conversation_messages;
create policy "Clinic members can insert messages"
  on public.conversation_messages for insert
  to authenticated
  with check (
    conversation_id in (
      select c.id
      from public.conversations c
      where public.is_clinic_member(c.clinic_id)
    )
    and (
      clinic_id is null
      or public.is_clinic_member(clinic_id)
    )
  );

-- ---------------------------------------------
-- Dashboard RPCs: SQL-owned metrics from real clinic rows
-- ---------------------------------------------
create or replace function public.get_dashboard_kpis(
  p_clinic_id uuid,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
)
returns table (
  total_conversations bigint,
  open_conversations bigint,
  escalated_conversations bigint,
  resolved_conversations bigint,
  captured_conversations bigint,
  helpful_conversations bigint,
  not_helpful_conversations bigint,
  total_leads bigint,
  new_leads bigint,
  contacted_leads bigint,
  booked_leads bigint,
  unanswered_count bigint,
  source_count bigint,
  trained_source_count bigint,
  stale_source_count bigint,
  total_knowledge_chunks bigint,
  whatsapp_clicks bigint,
  call_clicks bigint,
  location_clicks bigint,
  directions_clicks bigint,
  appointment_event_count bigint,
  after_hours_lead_count bigint
)
language sql
stable
set search_path = public
as $$
  with allowed as (
    select (
      public.is_clinic_member(p_clinic_id)
      or current_user = 'service_role'
      or current_user = 'postgres'
    ) as ok
  ),
  clinic_row as (
    select c.id, c.timezone
    from public.clinics c, allowed
    where allowed.ok
      and c.id = p_clinic_id
  ),
  filtered_conversations as (
    select c.*
    from public.conversations c, clinic_row cr
    where c.clinic_id = cr.id
      and (p_start_at is null or c.created_at >= p_start_at)
      and (p_end_at is null or c.created_at < p_end_at)
  ),
  filtered_leads as (
    select l.*
    from public.leads l, clinic_row cr
    where l.clinic_id = cr.id
      and (p_start_at is null or l.created_at >= p_start_at)
      and (p_end_at is null or l.created_at < p_end_at)
  ),
  filtered_events as (
    select e.*
    from public.interaction_events e, clinic_row cr
    where e.clinic_id = cr.id
      and (p_start_at is null or e.created_at >= p_start_at)
      and (p_end_at is null or e.created_at < p_end_at)
  ),
  after_hours as (
    select l.id
    from filtered_leads l
    join clinic_row cr on true
    left join public.clinic_hours ch
      on ch.clinic_id = cr.id
      and ch.day_of_week = extract(dow from (l.created_at at time zone cr.timezone))::int
    where ch.id is null
      or not ch.is_open
      or (l.created_at at time zone cr.timezone)::time < ch.open_time
      or (l.created_at at time zone cr.timezone)::time >= ch.close_time
      or (
        ch.break_start_time is not null
        and ch.break_end_time is not null
        and (l.created_at at time zone cr.timezone)::time >= ch.break_start_time
        and (l.created_at at time zone cr.timezone)::time < ch.break_end_time
      )
  )
  select
    (select count(*) from filtered_conversations),
    (select count(*) from filtered_conversations where status = 'active'),
    (select count(*) from filtered_conversations where status = 'pending'),
    (select count(*) from filtered_conversations where status = 'closed'),
    (select count(*) from filtered_conversations where lead_captured),
    (select count(*) from filtered_conversations where helpful_status = 'helpful'),
    (select count(*) from filtered_conversations where helpful_status = 'not_helpful'),
    (select count(*) from filtered_leads),
    (select count(*) from filtered_leads where status = 'new'),
    (select count(*) from filtered_leads where status = 'contacted'),
    (select count(*) from filtered_leads where status = 'booked'),
    (select count(*) from public.unanswered_questions uq, clinic_row cr where uq.clinic_id = cr.id and uq.status = 'open'),
    (select count(*) from public.knowledge_sources ks, clinic_row cr where ks.clinic_id = cr.id and ks.is_active and ks.source_type <> 'faq'),
    (select count(*) from public.knowledge_sources ks, clinic_row cr where ks.clinic_id = cr.id and ks.is_active and ks.status = 'trained' and ks.source_type <> 'faq'),
    (select count(*) from public.knowledge_sources ks, clinic_row cr where ks.clinic_id = cr.id and ks.is_active and ks.status in ('failed', 'draft', 'needs_review') and ks.source_type <> 'faq'),
    (select count(*) from public.knowledge_chunks kc, clinic_row cr where kc.clinic_id = cr.id and kc.is_active),
    (select count(*) from filtered_events where event_type in ('whatsapp_click', 'whatsapp_clicked')),
    (select count(*) from filtered_events where event_type = 'call_click'),
    (select count(*) from filtered_events where event_type in ('location_click', 'maps_clicked')),
    (select count(*) from filtered_events where event_type = 'directions_click'),
    (select count(*) from filtered_events where event_type = 'appointment_request'),
    (select count(*) from after_hours);
$$;

create or replace function public.get_dashboard_top_services(
  p_clinic_id uuid,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_limit int default 5
)
returns table (
  service_id uuid,
  service_name text,
  mention_count bigint
)
language sql
stable
set search_path = public
as $$
  with allowed as (
    select (
      public.is_clinic_member(p_clinic_id)
      or current_user = 'service_role'
      or current_user = 'postgres'
    ) as ok
  ),
  message_candidates as (
    select
      cm.service_id,
      case
        when (cm.metadata->>'service_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (cm.metadata->>'service_id')::uuid
        else null
      end as metadata_service_id,
      cm.created_at,
      c.clinic_id
    from public.conversation_messages cm
    join public.conversations c on c.id = cm.conversation_id
    join allowed on allowed.ok
  ),
  message_mentions as (
    select
      coalesce(mc.service_id, mc.metadata_service_id) as service_id,
      count(*) as mention_count
    from message_candidates mc
    where mc.clinic_id = p_clinic_id
      and (p_start_at is null or mc.created_at >= p_start_at)
      and (p_end_at is null or mc.created_at < p_end_at)
      and coalesce(mc.service_id, mc.metadata_service_id) is not null
    group by coalesce(mc.service_id, mc.metadata_service_id)
  )
  select
    s.id,
    s.name,
    mm.mention_count
  from message_mentions mm
  join public.services s on s.id = mm.service_id and s.clinic_id = p_clinic_id
  where s.is_active
  order by mm.mention_count desc, s.name asc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

grant execute on function public.get_dashboard_kpis(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_dashboard_top_services(uuid, timestamptz, timestamptz, int) to authenticated, service_role;

grant select, insert, update, delete on public.clinic_staff to authenticated, service_role;
grant select, insert, update, delete on public.appointments to authenticated, service_role;
