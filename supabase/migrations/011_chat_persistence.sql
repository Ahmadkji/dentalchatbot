-- =============================================
-- Feature 5: Chat persistence migration
-- Moves conversations, messages, leads, appointment requests,
-- unanswered questions, interaction events, and citations
-- from the in-memory db.ts layer to real Supabase tables.
-- =============================================

-- ---------------------------------------------
-- conversations
-- ---------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  channel text not null default 'web',
  status text not null default 'active'
    check (status in ('active', 'pending', 'closed')),
  subject text,
  source_page text,
  message_count integer not null default 0,
  last_message text,
  helpful_status text not null default 'unreviewed'
    check (helpful_status in ('helpful', 'not_helpful', 'unreviewed')),
  needs_improvement boolean not null default false,
  lead_captured boolean not null default false,
  appointment_requested boolean not null default false,
  public_token_hash text,
  visitor_id text,
  visitor_name text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- conversation_messages
-- ---------------------------------------------
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------
-- message_citations
-- ---------------------------------------------
create table public.message_citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  source_type text not null,
  source_title text,
  retrieval_score numeric,
  score_type text not null default 'lexical'
    check (score_type in ('lexical', 'vector', 'hybrid')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------
-- leads
-- ---------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  name text not null,
  phone text not null,
  question text not null default '',
  service text,
  preferred_date date,
  preferred_time text,
  message text,
  internal_note text,
  preferred_contact text not null default 'phone',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'booked', 'lost')),
  source text not null default 'chatbot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- appointment_requests
-- ---------------------------------------------
create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  name text not null,
  phone text not null,
  preferred_date date not null,
  preferred_time text not null,
  reason text not null default '',
  preferred_doctor text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  source text not null default 'chatbot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.appointment_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- unanswered_questions
-- ---------------------------------------------
create table public.unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  question text not null,
  source_page text,
  reason text,
  status text not null default 'open'
    check (status in ('open', 'answered', 'ignored')),
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.unanswered_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- interaction_events
-- ---------------------------------------------
create table public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  event_type text not null
    check (event_type in ('whatsapp_click', 'call_click', 'location_click', 'directions_click', 'appointment_request')),
  source text not null check (source in ('playground', 'widget')),
  service text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- =============================================
-- Indexes
-- =============================================
create index idx_conversations_clinic_id on public.conversations(clinic_id);
create index idx_conversations_clinic_id_updated_at on public.conversations(clinic_id, updated_at desc);
create index idx_conversations_public_token_hash on public.conversations(public_token_hash) where public_token_hash is not null;

create index idx_conversation_messages_conversation_id on public.conversation_messages(conversation_id);
create index idx_conversation_messages_conv_created on public.conversation_messages(conversation_id, created_at asc);

create index idx_message_citations_message_id on public.message_citations(message_id);
create index idx_message_citations_conversation_id on public.message_citations(conversation_id);

create index idx_leads_clinic_id on public.leads(clinic_id);
create index idx_leads_clinic_id_status on public.leads(clinic_id, status);

create index idx_appointment_requests_clinic_id on public.appointment_requests(clinic_id);
create index idx_appointment_requests_clinic_id_status on public.appointment_requests(clinic_id, status);

create index idx_unanswered_questions_clinic_id_status on public.unanswered_questions(clinic_id, status);

create index idx_interaction_events_clinic_id on public.interaction_events(clinic_id);
create index idx_interaction_events_conversation_id on public.interaction_events(conversation_id);

-- =============================================
-- RLS: enable on all tables
-- =============================================
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.message_citations enable row level security;
alter table public.leads enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.unanswered_questions enable row level security;
alter table public.interaction_events enable row level security;

-- =============================================
-- RLS policies: service_role full access on all tables
-- =============================================
create policy "Service role full access on conversations"
  on public.conversations for all
  to service_role
  using (true) with check (true);

create policy "Service role full access on conversation_messages"
  on public.conversation_messages for all
  to service_role
  using (true) with check (true);

create policy "Service role full access on message_citations"
  on public.message_citations for all
  to service_role
  using (true) with check (true);

create policy "Service role full access on leads"
  on public.leads for all
  to service_role
  using (true) with check (true);

create policy "Service role full access on appointment_requests"
  on public.appointment_requests for all
  to service_role
  using (true) with check (true);

create policy "Service role full access on unanswered_questions"
  on public.unanswered_questions for all
  to service_role
  using (true) with check (true);

create policy "Service role full access on interaction_events"
  on public.interaction_events for all
  to service_role
  using (true) with check (true);

-- =============================================
-- RLS policies: clinic members can read/write own clinic data
-- =============================================

-- Helper: clinic members can access data for their active clinics
-- Used as the USING clause for SELECT, UPDATE, DELETE on all chat tables.

-- conversations
create policy "Clinic members can read conversations"
  on public.conversations for select
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can insert conversations"
  on public.conversations for insert
  to authenticated
  with check (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can update conversations"
  on public.conversations for update
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can delete conversations"
  on public.conversations for delete
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

-- conversation_messages
create policy "Clinic members can read messages"
  on public.conversation_messages for select
  to authenticated
  using (
    conversation_id in (
      select c.id from public.conversations c
      inner join public.clinic_members cm on cm.clinic_id = c.clinic_id
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can insert messages"
  on public.conversation_messages for insert
  to authenticated
  with check (
    conversation_id in (
      select c.id from public.conversations c
      inner join public.clinic_members cm on cm.clinic_id = c.clinic_id
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

-- message_citations
create policy "Clinic members can read citations"
  on public.message_citations for select
  to authenticated
  using (
    conversation_id in (
      select c.id from public.conversations c
      inner join public.clinic_members cm on cm.clinic_id = c.clinic_id
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

-- leads
create policy "Clinic members can read leads"
  on public.leads for select
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can insert leads"
  on public.leads for insert
  to authenticated
  with check (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can update leads"
  on public.leads for update
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can delete leads"
  on public.leads for delete
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

-- appointment_requests
create policy "Clinic members can read appointment requests"
  on public.appointment_requests for select
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can insert appointment requests"
  on public.appointment_requests for insert
  to authenticated
  with check (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can update appointment requests"
  on public.appointment_requests for update
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can delete appointment requests"
  on public.appointment_requests for delete
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

-- unanswered_questions
create policy "Clinic members can read unanswered questions"
  on public.unanswered_questions for select
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can insert unanswered questions"
  on public.unanswered_questions for insert
  to authenticated
  with check (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can update unanswered questions"
  on public.unanswered_questions for update
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can delete unanswered questions"
  on public.unanswered_questions for delete
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

-- interaction_events
create policy "Clinic members can read interaction events"
  on public.interaction_events for select
  to authenticated
  using (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );

create policy "Clinic members can insert interaction events"
  on public.interaction_events for insert
  to authenticated
  with check (
    clinic_id in (
      select cm.clinic_id from public.clinic_members cm
      where cm.user_id = auth.uid() and cm.status = 'active'
    )
  );
