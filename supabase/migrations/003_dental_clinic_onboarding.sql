-- =============================================
-- Dental clinic onboarding foundation
-- Creates real clinic workspaces, memberships, widget defaults, bot defaults,
-- and quick prompts through one idempotent RPC.
-- =============================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  country text not null check (char_length(trim(country)) between 2 and 80),
  city text not null check (char_length(trim(city)) between 2 and 80),
  timezone text not null default 'Asia/Karachi',
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  website_url text check (website_url is null or website_url ~ '^https://[^[:space:]]+\.[^[:space:]]+$'),
  status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists public.widget_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  enabled boolean not null default false,
  widget_title text not null default 'Ask our dental clinic',
  welcome_message text not null default 'Hi! I can help with clinic hours, location, services, fees, and appointment requests.',
  primary_color text not null default '#059669' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  position text not null default 'bottom-right' check (position in ('bottom-right', 'bottom-left')),
  show_whatsapp_button boolean not null default true,
  show_call_button boolean not null default true,
  show_location_button boolean not null default true,
  allowed_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  bot_name text not null default 'Dental Assistant',
  tone text not null default 'friendly' check (tone in ('friendly', 'professional', 'concise')),
  fallback_message text not null default 'I''m not sure about that. Please contact the clinic directly for accurate information.',
  medical_disclaimer text not null default 'I can share clinic information, but I can''t diagnose dental or medical conditions.',
  emergency_message text not null default 'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, please contact the clinic or emergency services immediately.',
  appointment_mode text not null default 'whatsapp' check (appointment_mode in ('whatsapp', 'request_form', 'disabled')),
  whatsapp_handoff_enabled boolean not null default true,
  lead_capture_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_prompts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 2 and 60),
  intent text not null check (intent ~ '^[a-z0-9_]+$'),
  sort_order int not null check (sort_order > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, intent)
);

create table if not exists public.onboarding_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists default_clinic_id uuid;

alter table public.profiles
  drop column if exists clinic_name;

alter table public.profiles
  alter column timezone set default 'Asia/Karachi';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_clinic_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_default_clinic_id_fkey
      foreign key (default_clinic_id)
      references public.clinics(id)
      on delete set null;
  end if;
end $$;

drop trigger if exists on_auth_user_created on auth.users;

create index if not exists idx_profiles_default_clinic_id on public.profiles(default_clinic_id);
create index if not exists idx_clinics_owner_id on public.clinics(owner_id);
create index if not exists idx_clinic_members_user_id on public.clinic_members(user_id);
create index if not exists idx_clinic_members_clinic_id on public.clinic_members(clinic_id);
create index if not exists idx_quick_prompts_clinic_order on public.quick_prompts(clinic_id, sort_order);

drop trigger if exists clinics_updated_at on public.clinics;
create trigger clinics_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

drop trigger if exists clinic_members_updated_at on public.clinic_members;
create trigger clinic_members_updated_at
  before update on public.clinic_members
  for each row execute function public.set_updated_at();

drop trigger if exists widget_settings_updated_at on public.widget_settings;
create trigger widget_settings_updated_at
  before update on public.widget_settings
  for each row execute function public.set_updated_at();

drop trigger if exists bot_settings_updated_at on public.bot_settings;
create trigger bot_settings_updated_at
  before update on public.bot_settings
  for each row execute function public.set_updated_at();

drop trigger if exists quick_prompts_updated_at on public.quick_prompts;
create trigger quick_prompts_updated_at
  before update on public.quick_prompts
  for each row execute function public.set_updated_at();

create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    where cm.clinic_id = p_clinic_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
  );
$$;

create or replace function public.has_clinic_role(p_clinic_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    where cm.clinic_id = p_clinic_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and cm.role = any(p_roles)
  );
$$;

create or replace function public.slugify_clinic_name(p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ),
    'clinic'
  );
$$;

create or replace function public.complete_onboarding(
  p_full_name text,
  p_clinic_name text,
  p_country text,
  p_city text,
  p_timezone text,
  p_phone text,
  p_whatsapp text default null,
  p_website_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_clinic_name text := trim(coalesce(p_clinic_name, ''));
  v_country text := trim(coalesce(p_country, ''));
  v_city text := trim(coalesce(p_city, ''));
  v_timezone text := trim(coalesce(p_timezone, ''));
  v_phone text := regexp_replace(trim(coalesce(p_phone, '')), '\s+', '', 'g');
  v_whatsapp text := nullif(regexp_replace(trim(coalesce(p_whatsapp, '')), '\s+', '', 'g'), '');
  v_website_url text := nullif(regexp_replace(trim(coalesce(p_website_url, '')), '/+$', ''), '');
  v_clinic_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select email into v_email
  from auth.users
  where id = v_user_id;

  if v_email is null then
    raise exception 'Authenticated user not found.';
  end if;

  if char_length(v_full_name) < 2 or char_length(v_full_name) > 80 then
    raise exception 'Full name must be 2 to 80 characters.';
  end if;

  if char_length(v_clinic_name) < 2 or char_length(v_clinic_name) > 120 then
    raise exception 'Clinic name must be 2 to 120 characters.';
  end if;

  if char_length(v_country) < 2 or char_length(v_country) > 80 then
    raise exception 'Country is required.';
  end if;

  if char_length(v_city) < 2 or char_length(v_city) > 80 then
    raise exception 'City is required.';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Invalid timezone.';
  end if;

  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be in E.164 format, for example +923001234567.';
  end if;

  if v_whatsapp is not null and v_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'WhatsApp must be in E.164 format, for example +923001234567.';
  end if;

  if v_website_url is not null and v_website_url !~ '^https://[^[:space:]]+\.[^[:space:]]+$' then
    raise exception 'Website URL must be a valid https:// URL.';
  end if;

  insert into public.profiles (id, email, full_name, timezone)
  values (v_user_id, v_email, v_full_name, v_timezone)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        timezone = excluded.timezone;

  select default_clinic_id into v_clinic_id
  from public.profiles
  where id = v_user_id;

  if v_clinic_id is null or not exists (
    select 1
    from public.clinics c
    join public.clinic_members cm on cm.clinic_id = c.id
    where c.id = v_clinic_id
      and cm.user_id = v_user_id
      and cm.role = 'owner'
      and cm.status = 'active'
      and c.status <> 'deleted'
  ) then
    v_base_slug := public.slugify_clinic_name(v_clinic_name);
    v_slug := v_base_slug;

    while exists (select 1 from public.clinics where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix::text;
    end loop;

    insert into public.clinics (
      name,
      slug,
      country,
      city,
      timezone,
      phone,
      whatsapp,
      website_url,
      owner_id
    )
    values (
      v_clinic_name,
      v_slug,
      v_country,
      v_city,
      v_timezone,
      v_phone,
      v_whatsapp,
      v_website_url,
      v_user_id
    )
    returning id into v_clinic_id;
  else
    update public.clinics
    set name = v_clinic_name,
        country = v_country,
        city = v_city,
        timezone = v_timezone,
        phone = v_phone,
        whatsapp = v_whatsapp,
        website_url = v_website_url,
        status = case when status = 'deleted' then 'active' else status end,
        owner_id = coalesce(owner_id, v_user_id)
    where id = v_clinic_id;
  end if;

  insert into public.clinic_members (clinic_id, user_id, role, status)
  values (v_clinic_id, v_user_id, 'owner', 'active')
  on conflict (clinic_id, user_id) do update
    set role = case
          when public.clinic_members.role = 'owner' then public.clinic_members.role
          else excluded.role
        end,
        status = 'active';

  insert into public.widget_settings (
    clinic_id,
    enabled,
    widget_title,
    welcome_message,
    primary_color,
    position,
    show_whatsapp_button,
    show_call_button,
    show_location_button,
    allowed_domains
  )
  values (
    v_clinic_id,
    false,
    'Ask our dental clinic',
    'Hi! I can help with clinic hours, location, services, fees, and appointment requests.',
    '#059669',
    'bottom-right',
    v_whatsapp is not null,
    true,
    false,
    case when v_website_url is null then '{}'::text[] else array[v_website_url] end
  )
  on conflict (clinic_id) do update
    set show_whatsapp_button = excluded.show_whatsapp_button,
        allowed_domains = case
          when cardinality(public.widget_settings.allowed_domains) = 0 then excluded.allowed_domains
          else public.widget_settings.allowed_domains
        end;

  insert into public.bot_settings (
    clinic_id,
    bot_name,
    tone,
    fallback_message,
    medical_disclaimer,
    emergency_message,
    appointment_mode,
    whatsapp_handoff_enabled,
    lead_capture_enabled
  )
  values (
    v_clinic_id,
    'Dental Assistant',
    'friendly',
    'I''m not sure about that. Please contact the clinic directly for accurate information.',
    'I can share clinic information, but I can''t diagnose dental or medical conditions.',
    'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, please contact the clinic or emergency services immediately.',
    'whatsapp',
    true,
    true
  )
  on conflict (clinic_id) do nothing;

  insert into public.quick_prompts (clinic_id, label, intent, sort_order, is_active)
  values
    (v_clinic_id, 'Book Appointment', 'book_appointment', 1, true),
    (v_clinic_id, 'Clinic Hours', 'clinic_hours', 2, true),
    (v_clinic_id, 'Services & Fees', 'services_fees', 3, true),
    (v_clinic_id, 'Location', 'location', 4, true),
    (v_clinic_id, 'Talk on WhatsApp', 'talk_on_whatsapp', 5, v_whatsapp is not null),
    (v_clinic_id, 'Emergency Help', 'emergency_help', 6, true)
  on conflict (clinic_id, intent) do update
    set label = excluded.label,
        sort_order = excluded.sort_order;

  update public.profiles
  set full_name = v_full_name,
      timezone = v_timezone,
      onboarding_completed = true,
      onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      default_clinic_id = v_clinic_id
  where id = v_user_id;

  insert into public.onboarding_audit_logs (user_id, clinic_id, event, metadata)
  values (v_user_id, v_clinic_id, 'onboarding_completed', jsonb_build_object('source', 'complete_onboarding'));

  return jsonb_build_object('clinic_id', v_clinic_id, 'onboarding_completed', true);
end;
$$;

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.widget_settings enable row level security;
alter table public.bot_settings enable row level security;
alter table public.quick_prompts enable row level security;
alter table public.onboarding_audit_logs enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;
drop policy if exists "Users can update own editable profile fields" on public.profiles;

create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own editable profile fields"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Clinic members can read clinics" on public.clinics;
drop policy if exists "Owners and admins can update clinics" on public.clinics;

create policy "Clinic members can read clinics"
  on public.clinics
  for select
  to authenticated
  using (public.is_clinic_member(id));

create policy "Owners and admins can update clinics"
  on public.clinics
  for update
  to authenticated
  using (public.has_clinic_role(id, array['owner', 'admin']))
  with check (public.has_clinic_role(id, array['owner', 'admin']));

drop policy if exists "Clinic members can read memberships" on public.clinic_members;

create policy "Clinic members can read memberships"
  on public.clinic_members
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic members can read widget settings" on public.widget_settings;
drop policy if exists "Owners and admins can update widget settings" on public.widget_settings;

create policy "Clinic members can read widget settings"
  on public.widget_settings
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can update widget settings"
  on public.widget_settings
  for update
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read bot settings" on public.bot_settings;
drop policy if exists "Owners and admins can update bot settings" on public.bot_settings;

create policy "Clinic members can read bot settings"
  on public.bot_settings
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can update bot settings"
  on public.bot_settings
  for update
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read quick prompts" on public.quick_prompts;
drop policy if exists "Owners and admins can insert quick prompts" on public.quick_prompts;
drop policy if exists "Owners and admins can update quick prompts" on public.quick_prompts;
drop policy if exists "Owners and admins can delete quick prompts" on public.quick_prompts;

create policy "Clinic members can read quick prompts"
  on public.quick_prompts
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can insert quick prompts"
  on public.quick_prompts
  for insert
  to authenticated
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

create policy "Owners and admins can update quick prompts"
  on public.quick_prompts
  for update
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

create policy "Owners and admins can delete quick prompts"
  on public.quick_prompts
  for delete
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Users can read own onboarding audit logs" on public.onboarding_audit_logs;

create policy "Users can read own onboarding audit logs"
  on public.onboarding_audit_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon, authenticated;
revoke all on public.clinics from anon, authenticated;
revoke all on public.clinic_members from anon, authenticated;
revoke all on public.widget_settings from anon, authenticated;
revoke all on public.bot_settings from anon, authenticated;
revoke all on public.quick_prompts from anon, authenticated;
revoke all on public.onboarding_audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, timezone) on public.profiles to authenticated;
grant select, update on public.clinics to authenticated;
grant select on public.clinic_members to authenticated;
grant select, update on public.widget_settings to authenticated;
grant select, update on public.bot_settings to authenticated;
grant select, insert, update, delete on public.quick_prompts to authenticated;
grant select on public.onboarding_audit_logs to authenticated;

revoke all on function public.complete_onboarding(text, text, text, text, text, text, text, text) from public;
grant execute on function public.complete_onboarding(text, text, text, text, text, text, text, text) to authenticated;
