-- Human handoff requests
-- Durable source of truth for clinic staff notifications when a visitor
-- requests a human or the chatbot runs in human mode.

create table if not exists public.human_handoff_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  trigger_source text not null default 'chat_mode'
    check (trigger_source in ('chat_mode', 'user_request', 'widget_cta', 'admin_action', 'automation')),
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed')),
  recipient_emails text[] not null default '{}'::text[],
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  source_page text,
  latest_user_message text not null default '',
  assistant_message text not null default '',
  summary text not null default '',
  provider text not null default 'mailersend',
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, conversation_id)
);

create index if not exists idx_human_handoff_requests_clinic_status
  on public.human_handoff_requests (clinic_id, status, created_at desc);

create index if not exists idx_human_handoff_requests_conversation
  on public.human_handoff_requests (conversation_id);

alter table public.human_handoff_requests enable row level security;

drop trigger if exists human_handoff_requests_updated_at on public.human_handoff_requests;
create trigger human_handoff_requests_updated_at
  before update on public.human_handoff_requests
  for each row execute function public.set_updated_at();

drop policy if exists "Service role full access on human_handoff_requests" on public.human_handoff_requests;
create policy "Service role full access on human_handoff_requests"
  on public.human_handoff_requests for all
  to service_role
  using (true) with check (true);

drop policy if exists "Clinic members can read human handoff requests" on public.human_handoff_requests;
create policy "Clinic members can read human handoff requests"
  on public.human_handoff_requests for select
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id
      from public.clinic_members cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop policy if exists "Clinic members can insert human handoff requests" on public.human_handoff_requests;
create policy "Clinic members can insert human handoff requests"
  on public.human_handoff_requests for insert
  to authenticated
  with check (
    clinic_id in (
      select cm.clinic_id
      from public.clinic_members cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

drop policy if exists "Clinic members can update human handoff requests" on public.human_handoff_requests;
create policy "Clinic members can update human handoff requests"
  on public.human_handoff_requests for update
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id
      from public.clinic_members cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );
