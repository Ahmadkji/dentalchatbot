create table if not exists public.clinic_billing_freemius (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  user_email text,
  status text not null default 'free' check (status in ('free', 'pending', 'trial', 'active', 'canceled', 'expired')),
  fs_user_id text,
  fs_license_id text unique,
  fs_plan_id text,
  fs_pricing_id text,
  fs_subscription_id text,
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'annual', 'lifetime')),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  quota integer check (quota is null or quota >= 0),
  amount numeric(10, 2) check (amount is null or amount >= 0),
  expiration timestamptz,
  trial_ends_at timestamptz,
  is_canceled boolean not null default false,
  last_event_type text,
  last_event_id text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  target_plan_id text not null,
  target_pricing_id text,
  trial_mode text check (trial_mode is null or trial_mode in ('free', 'paid')),
  is_sandbox boolean not null default false,
  checkout_url text not null,
  expires_at timestamptz not null,
  fs_license_id text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clinic_billing_checkout_attempts_email_created
  on public.clinic_billing_checkout_attempts(user_email, created_at desc);

create index if not exists idx_clinic_billing_checkout_attempts_clinic_created
  on public.clinic_billing_checkout_attempts(clinic_id, created_at desc);

create index if not exists idx_clinic_billing_checkout_attempts_user_active
  on public.clinic_billing_checkout_attempts(user_id, expires_at desc);

create unique index if not exists idx_clinic_billing_checkout_attempts_license
  on public.clinic_billing_checkout_attempts(fs_license_id)
  where fs_license_id is not null;

alter table public.clinic_billing_freemius enable row level security;
alter table public.clinic_billing_checkout_attempts enable row level security;

grant select on public.clinic_billing_freemius to authenticated;
grant select, insert, update, delete on public.clinic_billing_freemius to service_role;
grant select, insert, update, delete on public.clinic_billing_checkout_attempts to service_role;

drop trigger if exists clinic_billing_freemius_updated_at on public.clinic_billing_freemius;
create trigger clinic_billing_freemius_updated_at
  before update on public.clinic_billing_freemius
  for each row execute function public.set_updated_at();

drop trigger if exists clinic_billing_checkout_attempts_updated_at on public.clinic_billing_checkout_attempts;
create trigger clinic_billing_checkout_attempts_updated_at
  before update on public.clinic_billing_checkout_attempts
  for each row execute function public.set_updated_at();
