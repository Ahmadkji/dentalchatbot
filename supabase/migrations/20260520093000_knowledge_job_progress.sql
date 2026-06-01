-- =============================================
-- Knowledge job progress tracking
-- =============================================

alter table public.knowledge_job_queue
  add column if not exists total_pages int not null default 0 check (total_pages >= 0),
  add column if not exists processed_pages int not null default 0 check (processed_pages >= 0),
  add column if not exists failed_pages int not null default 0 check (failed_pages >= 0),
  add column if not exists current_page_url text,
  add column if not exists progress_updated_at timestamptz not null default now();

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
        total_pages = 0,
        processed_pages = 0,
        failed_pages = 0,
        current_page_url = null,
        progress_updated_at = now(),
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
    total_pages,
    processed_pages,
    failed_pages,
    current_page_url,
    progress_updated_at,
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
    0,
    0,
    0,
    null,
    now(),
    v_user_id
  )
  returning * into v_existing;

  return v_existing;
end;
$$;
