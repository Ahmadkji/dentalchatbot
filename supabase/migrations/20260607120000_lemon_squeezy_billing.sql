-- =============================================
-- Lemon Squeezy billing source of truth
-- =============================================

create table if not exists public.clinic_billing_subscriptions (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  user_email text,
  provider text not null default 'lemonsqueezy' check (provider in ('lemonsqueezy')),
  status text not null default 'free' check (status in ('free', 'pending', 'trial', 'active', 'canceled', 'expired')),
  provider_status text,
  lemon_customer_id text,
  lemon_order_id text,
  lemon_order_item_id text,
  lemon_subscription_id text unique,
  lemon_product_id text,
  lemon_variant_id text,
  lemon_product_name text,
  lemon_variant_name text,
  billing_cycle text check (billing_cycle is null or billing_cycle in ('day', 'week', 'month', 'year', 'lifetime')),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  renews_at timestamptz,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  is_canceled boolean not null default false,
  test_mode boolean not null default false,
  customer_portal_url text,
  update_payment_method_url text,
  last_event_type text,
  last_event_id text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  provider text not null default 'lemonsqueezy' check (provider in ('lemonsqueezy')),
  target_variant_id text not null,
  test_mode boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'checkout_created', 'processed', 'expired', 'failed')),
  lemon_checkout_id text unique,
  checkout_url text,
  expires_at timestamptz not null,
  processed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'lemonsqueezy' check (provider in ('lemonsqueezy')),
  event_name text not null,
  event_key text,
  payload_sha256 text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'duplicate', 'ignored', 'failed')),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinic_billing_subscriptions_status
  on public.clinic_billing_subscriptions(status, updated_at desc);

create index if not exists idx_clinic_billing_subscriptions_customer
  on public.clinic_billing_subscriptions(lemon_customer_id)
  where lemon_customer_id is not null;

create index if not exists idx_clinic_billing_checkout_sessions_clinic_created
  on public.clinic_billing_checkout_sessions(clinic_id, created_at desc);

create index if not exists idx_clinic_billing_checkout_sessions_user_status
  on public.clinic_billing_checkout_sessions(user_id, status, expires_at desc);

create unique index if not exists idx_clinic_billing_checkout_sessions_active_unique
  on public.clinic_billing_checkout_sessions(clinic_id, user_id, target_variant_id, test_mode)
  where status in ('pending', 'checkout_created');

create unique index if not exists idx_clinic_billing_webhook_events_payload_hash
  on public.clinic_billing_webhook_events(provider, payload_sha256);

alter table public.clinic_billing_subscriptions enable row level security;
alter table public.clinic_billing_checkout_sessions enable row level security;
alter table public.clinic_billing_webhook_events enable row level security;

grant select on public.clinic_billing_subscriptions to authenticated;
grant select on public.clinic_billing_checkout_sessions to authenticated;
grant select, insert, update, delete on public.clinic_billing_subscriptions to service_role;
grant select, insert, update, delete on public.clinic_billing_checkout_sessions to service_role;
grant select, insert, update, delete on public.clinic_billing_webhook_events to service_role;

drop policy if exists "Service role full access on billing subscriptions" on public.clinic_billing_subscriptions;
create policy "Service role full access on billing subscriptions"
  on public.clinic_billing_subscriptions for all
  to service_role
  using (true) with check (true);

drop policy if exists "Service role full access on billing checkout sessions" on public.clinic_billing_checkout_sessions;
create policy "Service role full access on billing checkout sessions"
  on public.clinic_billing_checkout_sessions for all
  to service_role
  using (true) with check (true);

drop policy if exists "Service role full access on billing webhook events" on public.clinic_billing_webhook_events;
create policy "Service role full access on billing webhook events"
  on public.clinic_billing_webhook_events for all
  to service_role
  using (true) with check (true);

drop policy if exists "Clinic members can read billing subscriptions" on public.clinic_billing_subscriptions;
create policy "Clinic members can read billing subscriptions"
  on public.clinic_billing_subscriptions for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

drop policy if exists "Clinic admins can read billing checkout sessions" on public.clinic_billing_checkout_sessions;
create policy "Clinic admins can read billing checkout sessions"
  on public.clinic_billing_checkout_sessions for select
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop trigger if exists clinic_billing_subscriptions_updated_at on public.clinic_billing_subscriptions;
create trigger clinic_billing_subscriptions_updated_at
  before update on public.clinic_billing_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists clinic_billing_checkout_sessions_updated_at on public.clinic_billing_checkout_sessions;
create trigger clinic_billing_checkout_sessions_updated_at
  before update on public.clinic_billing_checkout_sessions
  for each row execute function public.set_updated_at();
