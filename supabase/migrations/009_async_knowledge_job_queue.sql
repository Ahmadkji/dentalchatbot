-- =============================================
-- Feature 4 follow-up: durable async knowledge job queue
-- =============================================

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_status_check;

alter table public.knowledge_sources
  add constraint knowledge_sources_status_check
  check (status in ('draft', 'queued', 'processing', 'trained', 'failed', 'needs_review', 'disabled'));

create table if not exists public.knowledge_job_queue (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  source_id uuid references public.knowledge_sources(id) on delete cascade,
  job_type text not null check (
    job_type in (
      'process_source_content',
      'import_website_source',
      'process_file_source',
      'import_sitemap'
    )
  ),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempt_count int not null default 0 check (attempt_count >= 0),
  max_attempts int not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_job_queue_claim
  on public.knowledge_job_queue (status, available_at, created_at);

create index if not exists idx_knowledge_job_queue_clinic_status
  on public.knowledge_job_queue (clinic_id, status, created_at desc);

create unique index if not exists idx_knowledge_job_queue_active_source_job
  on public.knowledge_job_queue (source_id, job_type)
  where source_id is not null
    and status in ('queued', 'processing');

create unique index if not exists idx_knowledge_job_queue_active_sitemap_job
  on public.knowledge_job_queue (clinic_id, job_type)
  where source_id is null
    and job_type = 'import_sitemap'
    and status in ('queued', 'processing');

drop trigger if exists knowledge_job_queue_updated_at on public.knowledge_job_queue;
create trigger knowledge_job_queue_updated_at
  before update on public.knowledge_job_queue
  for each row execute function public.set_updated_at();

drop function if exists public.enqueue_knowledge_job(uuid, uuid, text, jsonb, int);
create or replace function public.enqueue_knowledge_job(
  p_clinic_id uuid,
  p_source_id uuid,
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_max_attempts int default 3
)
returns public.knowledge_job_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.knowledge_job_queue;
  v_source public.knowledge_sources;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_clinic_role(p_clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to manage knowledge jobs for this clinic.';
  end if;

  if p_job_type not in (
    'process_source_content',
    'import_website_source',
    'process_file_source',
    'import_sitemap'
  ) then
    raise exception 'Unsupported knowledge job type.';
  end if;

  if p_source_id is not null then
    select *
    into v_source
    from public.knowledge_sources
    where id = p_source_id
      and clinic_id = p_clinic_id
    for update;

    if v_source.id is null then
      raise exception 'Knowledge source not found for this clinic.';
    end if;
  end if;

  if p_source_id is not null then
    select *
    into v_existing
    from public.knowledge_job_queue
    where source_id = p_source_id
      and job_type = p_job_type
      and status in ('queued', 'processing')
    limit 1
    for update;
  elsif p_job_type = 'import_sitemap' then
    select *
    into v_existing
    from public.knowledge_job_queue
    where clinic_id = p_clinic_id
      and source_id is null
      and job_type = p_job_type
      and status in ('queued', 'processing')
    limit 1
    for update;
  end if;

  if v_existing.id is not null then
    update public.knowledge_job_queue
    set payload = v_payload,
        status = 'queued',
        available_at = now(),
        finished_at = null,
        locked_at = null,
        locked_by = null,
        last_error = null,
        max_attempts = greatest(1, least(coalesce(p_max_attempts, 3), 10))
    where id = v_existing.id
    returning * into v_existing;

    return v_existing;
  end if;

  insert into public.knowledge_job_queue (
    clinic_id,
    source_id,
    job_type,
    status,
    payload,
    attempt_count,
    max_attempts,
    available_at,
    created_by
  )
  values (
    p_clinic_id,
    p_source_id,
    p_job_type,
    'queued',
    v_payload,
    0,
    greatest(1, least(coalesce(p_max_attempts, 3), 10)),
    now(),
    v_user_id
  )
  returning * into v_existing;

  return v_existing;
end;
$$;

drop function if exists public.claim_knowledge_jobs(int, text);
create or replace function public.claim_knowledge_jobs(
  p_limit int default 1,
  p_worker text default 'knowledge-worker'
)
returns setof public.knowledge_job_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimable as (
    select id
    from public.knowledge_job_queue
    where (
      status = 'queued'
      and available_at <= now()
    ) or (
      status = 'processing'
      and locked_at is not null
      and locked_at <= now() - interval '15 minutes'
    )
    order by created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 1), 10))
  ), updated as (
    update public.knowledge_job_queue job
    set status = 'processing',
        started_at = now(),
        locked_at = now(),
        locked_by = nullif(trim(coalesce(p_worker, 'knowledge-worker')), ''),
        finished_at = null,
        last_error = null,
        attempt_count = case
          when job.status = 'queued' then job.attempt_count + 1
          else job.attempt_count
        end
    from claimable
    where job.id = claimable.id
    returning job.*
  )
  select *
  from updated;
end;
$$;

alter table public.knowledge_job_queue enable row level security;

drop policy if exists "Clinic members can read knowledge jobs" on public.knowledge_job_queue;
drop policy if exists "Owners and admins can manage knowledge jobs" on public.knowledge_job_queue;

create policy "Clinic members can read knowledge jobs"
  on public.knowledge_job_queue
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage knowledge jobs"
  on public.knowledge_job_queue
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

revoke all on public.knowledge_job_queue from anon;
revoke all on public.knowledge_job_queue from authenticated;
grant select on public.knowledge_job_queue to authenticated;

revoke all on function public.enqueue_knowledge_job(uuid, uuid, text, jsonb, int) from public;
grant execute on function public.enqueue_knowledge_job(uuid, uuid, text, jsonb, int) to authenticated;

revoke all on function public.claim_knowledge_jobs(int, text) from public;
grant execute on function public.claim_knowledge_jobs(int, text) to service_role;
