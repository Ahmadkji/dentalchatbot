-- =============================================
-- User-owned app tables with ownership-based RLS
-- Apply after the profiles migration.
-- =============================================

create extension if not exists pgcrypto;

-- Generic updated_at trigger helper.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,
  status text not null default 'draft',
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices enable row level security;
grant select, insert, update, delete on public.invoices to anon, authenticated, service_role;

drop policy if exists "Users manage own invoices" on public.invoices;
create policy "Users manage own invoices"
  on public.invoices
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.set_updated_at();

create index if not exists idx_invoices_user_id on public.invoices (user_id);

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;
grant select, insert, update, delete on public.clients to anon, authenticated, service_role;

drop policy if exists "Users manage own clients" on public.clients;
create policy "Users manage own clients"
  on public.clients
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

create index if not exists idx_clients_user_id on public.clients (user_id);

-- Time entries
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  minutes integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.time_entries enable row level security;
grant select, insert, update, delete on public.time_entries to anon, authenticated, service_role;

drop policy if exists "Users manage own time entries" on public.time_entries;
create policy "Users manage own time entries"
  on public.time_entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists time_entries_updated_at on public.time_entries;
create trigger time_entries_updated_at
  before update on public.time_entries
  for each row
  execute function public.set_updated_at();

create index if not exists idx_time_entries_user_id on public.time_entries (user_id);

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid,
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
grant select, insert, update, delete on public.payments to anon, authenticated, service_role;

drop policy if exists "Users manage own payments" on public.payments;
create policy "Users manage own payments"
  on public.payments
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

create index if not exists idx_payments_user_id on public.payments (user_id);

-- Settings
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  onboarding_completed boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
grant select, insert, update, delete on public.settings to anon, authenticated, service_role;

drop policy if exists "Users manage own settings" on public.settings;
create policy "Users manage own settings"
  on public.settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at
  before update on public.settings
  for each row
  execute function public.set_updated_at();

create index if not exists idx_settings_user_id on public.settings (user_id);

-- Subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
grant select, insert, update, delete on public.subscriptions to anon, authenticated, service_role;

drop policy if exists "Users manage own subscriptions" on public.subscriptions;
create policy "Users manage own subscriptions"
  on public.subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

-- Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  send_at timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminders enable row level security;
grant select, insert, update, delete on public.reminders to anon, authenticated, service_role;

drop policy if exists "Users manage own reminders" on public.reminders;
create policy "Users manage own reminders"
  on public.reminders
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists reminders_updated_at on public.reminders;
create trigger reminders_updated_at
  before update on public.reminders
  for each row
  execute function public.set_updated_at();

create index if not exists idx_reminders_user_id on public.reminders (user_id);
