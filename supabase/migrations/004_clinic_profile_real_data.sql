-- =============================================
-- Feature 2: trusted clinic profile, hours, services, and AI-safe profile view
-- =============================================

alter table public.clinics
  add column if not exists address text,
  add column if not exists map_link text,
  add column if not exists pricing_notes text,
  add column if not exists appointment_rules text,
  add column if not exists emergency_instructions text,
  add column if not exists profile_completed boolean not null default false,
  add column if not exists is_live boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinics_map_link_https_check'
      and conrelid = 'public.clinics'::regclass
  ) then
    alter table public.clinics
      add constraint clinics_map_link_https_check
      check (map_link is null or map_link ~ '^https://[^[:space:]]+$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinics_live_requires_emergency_check'
      and conrelid = 'public.clinics'::regclass
  ) then
    alter table public.clinics
      add constraint clinics_live_requires_emergency_check
      check (
        not is_live
        or (
          emergency_instructions is not null
          and char_length(trim(emergency_instructions)) >= 10
        )
      );
  end if;
end $$;

create table if not exists public.clinic_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  is_open boolean not null default false,
  open_time time,
  close_time time,
  break_start_time time,
  break_end_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, day_of_week),
  constraint clinic_hours_open_window_check check (
    (not is_open and open_time is null and close_time is null and break_start_time is null and break_end_time is null)
    or (
      is_open
      and open_time is not null
      and close_time is not null
      and close_time > open_time
    )
  ),
  constraint clinic_hours_break_window_check check (
    (break_start_time is null and break_end_time is null)
    or (
      is_open
      and break_start_time is not null
      and break_end_time is not null
      and break_start_time >= open_time
      and break_end_time <= close_time
      and break_end_time > break_start_time
    )
  )
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  category text,
  price_amount numeric(10, 2) check (price_amount is null or price_amount >= 0),
  price_currency text check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  pricing_note text,
  duration_minutes int not null check (duration_minutes > 0),
  is_active boolean not null default true,
  sort_order int not null default 100 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_services_clinic_lower_name
  on public.services (clinic_id, lower(name));

create table if not exists public.clinic_profile_audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event text not null,
  entity_type text not null check (entity_type in ('clinic_profile', 'clinic_hours', 'service', 'chat_profile')),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinic_hours_clinic_id on public.clinic_hours(clinic_id);
create index if not exists idx_services_clinic_id on public.services(clinic_id);
create index if not exists idx_services_clinic_active on public.services(clinic_id, is_active, sort_order);
create index if not exists idx_clinic_profile_audit_logs_clinic_id on public.clinic_profile_audit_logs(clinic_id, created_at desc);

drop trigger if exists clinic_hours_updated_at on public.clinic_hours;
create trigger clinic_hours_updated_at
  before update on public.clinic_hours
  for each row execute function public.set_updated_at();

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create or replace function public.refresh_clinic_profile_status(p_clinic_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed boolean;
begin
  select
    c.phone is not null
    and char_length(trim(coalesce(c.address, ''))) > 0
    and char_length(trim(coalesce(c.emergency_instructions, ''))) > 0
    and exists (
      select 1
      from public.clinic_hours ch
      where ch.clinic_id = c.id
    )
    and exists (
      select 1
      from public.services s
      where s.clinic_id = c.id
        and s.is_active
    )
  into v_completed
  from public.clinics c
  where c.id = p_clinic_id;

  update public.clinics
  set profile_completed = coalesce(v_completed, false)
  where id = p_clinic_id;

  return coalesce(v_completed, false);
end;
$$;

create or replace function public.replace_clinic_hours(
  p_clinic_id uuid,
  p_hours jsonb
)
returns setof public.clinic_hours
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_day int;
  v_is_open boolean;
  v_open time;
  v_close time;
  v_break_start time;
  v_break_end time;
  v_notes text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_clinic_role(p_clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to update clinic hours.';
  end if;

  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) <> 7 then
    raise exception 'Clinic hours payload must include exactly 7 days.';
  end if;

  if exists (
    select 1
    from (
      select (value ->> 'day_of_week')::int as day_of_week, count(*) as total
      from jsonb_array_elements(p_hours)
      group by 1
    ) dupes
    where dupes.day_of_week not between 0 and 6
       or dupes.total <> 1
  ) then
    raise exception 'Clinic hours must contain each day_of_week from 0 to 6 exactly once.';
  end if;

  delete from public.clinic_hours
  where clinic_id = p_clinic_id;

  for v_row in
    select value
    from jsonb_array_elements(p_hours)
  loop
    v_day := (v_row ->> 'day_of_week')::int;
    v_is_open := coalesce((v_row ->> 'is_open')::boolean, false);
    v_open := nullif(v_row ->> 'open_time', '')::time;
    v_close := nullif(v_row ->> 'close_time', '')::time;
    v_break_start := nullif(v_row ->> 'break_start_time', '')::time;
    v_break_end := nullif(v_row ->> 'break_end_time', '')::time;
    v_notes := nullif(trim(coalesce(v_row ->> 'notes', '')), '');

    insert into public.clinic_hours (
      clinic_id,
      day_of_week,
      is_open,
      open_time,
      close_time,
      break_start_time,
      break_end_time,
      notes
    )
    values (
      p_clinic_id,
      v_day,
      v_is_open,
      v_open,
      v_close,
      v_break_start,
      v_break_end,
      v_notes
    );
  end loop;

  insert into public.clinic_profile_audit_logs (
    clinic_id,
    actor_user_id,
    event,
    entity_type,
    metadata
  )
  values (
    p_clinic_id,
    v_user_id,
    'clinic_hours_replaced',
    'clinic_hours',
    jsonb_build_object('days', 7)
  );

  perform public.refresh_clinic_profile_status(p_clinic_id);

  return query
  select *
  from public.clinic_hours
  where clinic_id = p_clinic_id
  order by day_of_week asc;
end;
$$;

create or replace view public.clinic_ai_profile_view
with (security_invoker = true)
as
select
  c.id as clinic_id,
  c.name,
  c.slug,
  c.country,
  c.city,
  c.address,
  c.timezone,
  c.phone,
  c.whatsapp,
  c.website_url,
  c.map_link,
  c.pricing_notes,
  c.appointment_rules,
  c.emergency_instructions,
  c.profile_completed,
  c.is_live,
  c.status,
  bs.bot_name,
  bs.tone,
  bs.fallback_message,
  bs.medical_disclaimer,
  bs.emergency_message,
  bs.appointment_mode,
  bs.whatsapp_handoff_enabled,
  bs.lead_capture_enabled,
  ws.enabled as widget_enabled,
  ws.widget_title,
  ws.welcome_message,
  ws.primary_color,
  ws.position as widget_position,
  ws.show_whatsapp_button,
  ws.show_call_button,
  ws.show_location_button,
  ws.allowed_domains,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'day_of_week', ch.day_of_week,
          'is_open', ch.is_open,
          'open_time', to_char(ch.open_time, 'HH24:MI'),
          'close_time', to_char(ch.close_time, 'HH24:MI'),
          'break_start_time', case when ch.break_start_time is null then null else to_char(ch.break_start_time, 'HH24:MI') end,
          'break_end_time', case when ch.break_end_time is null then null else to_char(ch.break_end_time, 'HH24:MI') end,
          'notes', ch.notes
        )
        order by ch.day_of_week
      )
      from public.clinic_hours ch
      where ch.clinic_id = c.id
    ),
    '[]'::jsonb
  ) as clinic_hours,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'category', s.category,
          'price_amount', s.price_amount,
          'price_currency', s.price_currency,
          'pricing_note', s.pricing_note,
          'duration_minutes', s.duration_minutes,
          'sort_order', s.sort_order
        )
        order by s.sort_order, s.name
      )
      from public.services s
      where s.clinic_id = c.id
        and s.is_active
    ),
    '[]'::jsonb
  ) as active_services
from public.clinics c
left join public.bot_settings bs on bs.clinic_id = c.id
left join public.widget_settings ws on ws.clinic_id = c.id;

grant select on public.clinic_ai_profile_view to authenticated;

alter table public.clinic_hours enable row level security;
alter table public.services enable row level security;
alter table public.clinic_profile_audit_logs enable row level security;

drop policy if exists "Clinic members can read clinic hours" on public.clinic_hours;
drop policy if exists "Owners and admins can manage clinic hours" on public.clinic_hours;

create policy "Clinic members can read clinic hours"
  on public.clinic_hours
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage clinic hours"
  on public.clinic_hours
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read services" on public.services;
drop policy if exists "Owners and admins can manage services" on public.services;

create policy "Clinic members can read services"
  on public.services
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage services"
  on public.services
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Owners and admins can read clinic profile audit logs" on public.clinic_profile_audit_logs;
drop policy if exists "Owners and admins can insert clinic profile audit logs" on public.clinic_profile_audit_logs;

create policy "Owners and admins can read clinic profile audit logs"
  on public.clinic_profile_audit_logs
  for select
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']));

create policy "Owners and admins can insert clinic profile audit logs"
  on public.clinic_profile_audit_logs
  for insert
  to authenticated
  with check (
    public.has_clinic_role(clinic_id, array['owner', 'admin'])
    and actor_user_id = (select auth.uid())
  );

select public.refresh_clinic_profile_status(id)
from public.clinics;
