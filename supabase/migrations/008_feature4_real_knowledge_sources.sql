-- =============================================
-- Feature 4: real knowledge sources, files, FAQ, and retrieval lifecycle
-- =============================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------
-- knowledge_sources evolution
-- ---------------------------------------------

drop index if exists public.idx_knowledge_sources_clinic_url;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_sources'
      and column_name = 'type'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_sources'
      and column_name = 'source_type'
  ) then
    alter table public.knowledge_sources rename column type to source_type;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_sources'
      and column_name = 'error_message'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_sources'
      and column_name = 'failed_reason'
  ) then
    alter table public.knowledge_sources rename column error_message to failed_reason;
  end if;
end $$;

alter table public.knowledge_sources
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists trained_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_type_check,
  drop constraint if exists knowledge_sources_source_type_check,
  drop constraint if exists knowledge_sources_status_check;

update public.knowledge_sources
set source_type = case source_type
  when 'website' then 'website_url'
  when 'file' then 'file_upload'
  else source_type
end
where source_type in ('website', 'file');

update public.knowledge_sources
set status = case status
  when 'needs_refresh' then 'trained'
  else status
end
where status = 'needs_refresh';

alter table public.knowledge_sources
  alter column status set default 'draft';

alter table public.knowledge_sources
  add constraint knowledge_sources_source_type_check
  check (source_type in ('manual_text', 'website_url', 'file_upload', 'faq'));

alter table public.knowledge_sources
  add constraint knowledge_sources_status_check
  check (status in ('draft', 'processing', 'trained', 'failed', 'needs_review', 'disabled'));

create unique index if not exists idx_knowledge_sources_clinic_url
  on public.knowledge_sources (clinic_id, source_type, source_url)
  where source_url is not null;

create index if not exists idx_knowledge_sources_clinic_active_status
  on public.knowledge_sources (clinic_id, is_active, status, updated_at desc);

-- ---------------------------------------------
-- knowledge_chunks evolution
-- ---------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_chunks'
      and column_name = 'content'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_chunks'
      and column_name = 'chunk_text'
  ) then
    alter table public.knowledge_chunks rename column content to chunk_text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_chunks'
      and column_name = 'token_estimate'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_chunks'
      and column_name = 'token_count'
  ) then
    alter table public.knowledge_chunks rename column token_estimate to token_count;
  end if;
end $$;

alter table public.knowledge_chunks
  add column if not exists is_active boolean not null default true,
  add column if not exists content_hash text,
  add column if not exists source_type text,
  add column if not exists source_url text,
  add column if not exists page_title text,
  add column if not exists section_heading text,
  add column if not exists file_name text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedding_dimension int;

update public.knowledge_chunks kc
set
  source_type = ks.source_type,
  source_url = ks.source_url,
  file_name = ks.file_name,
  last_synced_at = coalesce(ks.last_synced_at, kc.updated_at)
from public.knowledge_sources ks
where ks.id = kc.source_id
  and (
    kc.source_type is null
    or kc.source_url is null
    or kc.file_name is null
    or kc.last_synced_at is null
  );

alter table public.knowledge_chunks
  drop column if exists search_document;

alter table public.knowledge_chunks
  add column search_document tsvector
  generated always as (
    to_tsvector(
      'simple',
      coalesce(section_heading, '')
      || ' '
      || coalesce(page_title, '')
      || ' '
      || coalesce(file_name, '')
      || ' '
      || coalesce(chunk_text, '')
    )
  ) stored;

create index if not exists idx_knowledge_chunks_clinic_active
  on public.knowledge_chunks (clinic_id, is_active, source_id, sort_order);

create index if not exists idx_knowledge_chunks_search_document
  on public.knowledge_chunks using gin (search_document);

create index if not exists idx_knowledge_chunks_source_type
  on public.knowledge_chunks (clinic_id, source_type, is_active);

-- ---------------------------------------------
-- file storage + FAQ + processing runs
-- ---------------------------------------------

create table if not exists public.knowledge_source_files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  bucket_name text not null check (char_length(trim(bucket_name)) between 3 and 63),
  storage_path text not null check (char_length(trim(storage_path)) between 3 and 512),
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  file_type text not null check (char_length(trim(file_type)) between 1 and 80),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 20971520),
  mime_type text not null check (char_length(trim(mime_type)) between 3 and 255),
  upload_status text not null default 'uploaded' check (upload_status in ('uploaded', 'failed', 'deleted')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id),
  unique (bucket_name, storage_path)
);

create index if not exists idx_knowledge_source_files_clinic_source
  on public.knowledge_source_files (clinic_id, source_id);

drop trigger if exists knowledge_source_files_updated_at on public.knowledge_source_files;
create trigger knowledge_source_files_updated_at
  before update on public.knowledge_source_files
  for each row execute function public.set_updated_at();

create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  knowledge_source_id uuid unique references public.knowledge_sources(id) on delete set null,
  question text not null check (char_length(trim(question)) between 3 and 300),
  answer text not null check (char_length(trim(answer)) between 3 and 5000),
  category text,
  is_active boolean not null default true,
  sort_order int not null default 1 check (sort_order > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_faq_entries_clinic_active_order
  on public.faq_entries (clinic_id, is_active, sort_order, created_at);

drop trigger if exists faq_entries_updated_at on public.faq_entries;
create trigger faq_entries_updated_at
  before update on public.faq_entries
  for each row execute function public.set_updated_at();

create table if not exists public.knowledge_processing_runs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'trained', 'failed', 'disabled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  chunks_created int not null default 0 check (chunks_created >= 0),
  chunks_disabled int not null default 0 check (chunks_disabled >= 0),
  embeddings_created int not null default 0 check (embeddings_created >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_knowledge_processing_runs_source_started
  on public.knowledge_processing_runs (source_id, started_at desc);

-- ---------------------------------------------
-- replace chunk lifecycle function
-- ---------------------------------------------

drop function if exists public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz);
create or replace function public.replace_knowledge_source_chunks(
  p_source_id uuid,
  p_title text,
  p_content text,
  p_status text,
  p_failed_reason text,
  p_chunks jsonb,
  p_last_synced_at timestamptz default now()
)
returns public.knowledge_sources
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.knowledge_sources;
  v_chunk jsonb;
  v_run_id uuid;
  v_chunk_count int := 0;
  v_disabled_count int := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id
  for update;

  if v_source.id is null then
    raise exception 'Knowledge source not found.';
  end if;

  if not public.has_clinic_role(v_source.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to manage this knowledge source.';
  end if;

  if jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'Knowledge chunks payload must be an array.';
  end if;

  insert into public.knowledge_processing_runs (
    clinic_id,
    source_id,
    status,
    created_by,
    metadata
  )
  values (
    v_source.clinic_id,
    p_source_id,
    'processing',
    v_user_id,
    jsonb_build_object('trigger', 'sync', 'source_type', v_source.source_type)
  )
  returning id into v_run_id;

  begin
    update public.knowledge_sources
    set title = trim(p_title),
        content = p_content,
        status = 'processing',
        failed_reason = null
    where id = p_source_id;

    update public.knowledge_chunks
    set is_active = false,
        updated_at = now()
    where source_id = p_source_id
      and is_active = true;

    get diagnostics v_disabled_count = row_count;

    for v_chunk in
      select value
      from jsonb_array_elements(p_chunks)
    loop
      v_chunk_count := v_chunk_count + 1;

      insert into public.knowledge_chunks (
        clinic_id,
        source_id,
        chunk_text,
        sort_order,
        token_count,
        is_active,
        content_hash,
        source_type,
        source_url,
        page_title,
        section_heading,
        file_name,
        last_synced_at,
        embedding,
        embedding_model,
        embedding_dimension
      )
      values (
        v_source.clinic_id,
        p_source_id,
        coalesce(v_chunk ->> 'chunk_text', ''),
        (v_chunk ->> 'sort_order')::int,
        coalesce((v_chunk ->> 'token_count')::int, 0),
        true,
        nullif(v_chunk ->> 'content_hash', ''),
        coalesce(nullif(v_chunk ->> 'source_type', ''), v_source.source_type),
        nullif(v_chunk ->> 'source_url', ''),
        nullif(v_chunk ->> 'page_title', ''),
        nullif(v_chunk ->> 'section_heading', ''),
        nullif(v_chunk ->> 'file_name', ''),
        coalesce(p_last_synced_at, now()),
        null,
        nullif(v_chunk ->> 'embedding_model', ''),
        case
          when coalesce(v_chunk ->> 'embedding_dimension', '') ~ '^\d+$' then (v_chunk ->> 'embedding_dimension')::int
          else null
        end
      )
      on conflict (source_id, sort_order) do update
      set chunk_text = excluded.chunk_text,
          token_count = excluded.token_count,
          is_active = true,
          content_hash = excluded.content_hash,
          source_type = excluded.source_type,
          source_url = excluded.source_url,
          page_title = excluded.page_title,
          section_heading = excluded.section_heading,
          file_name = excluded.file_name,
          last_synced_at = excluded.last_synced_at,
          embedding = excluded.embedding,
          embedding_model = excluded.embedding_model,
          embedding_dimension = excluded.embedding_dimension,
          updated_at = now();
    end loop;

    update public.knowledge_sources
    set title = trim(p_title),
        content = p_content,
        status = p_status,
        failed_reason = p_failed_reason,
        last_synced_at = p_last_synced_at,
        trained_at = case when p_status = 'trained' then now() else trained_at end,
        chunk_count = v_chunk_count
    where id = p_source_id;

    update public.knowledge_processing_runs
    set status = p_status,
        finished_at = now(),
        error_message = p_failed_reason,
        chunks_created = v_chunk_count,
        chunks_disabled = v_disabled_count,
        embeddings_created = 0
    where id = v_run_id;
  exception
    when others then
      update public.knowledge_sources
      set status = 'failed',
          failed_reason = coalesce(sqlerrm, 'Failed to process knowledge source.')
      where id = p_source_id;

      update public.knowledge_processing_runs
      set status = 'failed',
          finished_at = now(),
          error_message = coalesce(sqlerrm, 'Failed to process knowledge source.'),
          chunks_created = v_chunk_count,
          chunks_disabled = v_disabled_count
      where id = v_run_id;

      raise;
  end;

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id;

  return v_source;
end;
$$;

create or replace function public.disable_knowledge_source(
  p_source_id uuid
)
returns public.knowledge_sources
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.knowledge_sources;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id
  for update;

  if v_source.id is null then
    raise exception 'Knowledge source not found.';
  end if;

  if not public.has_clinic_role(v_source.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to manage this knowledge source.';
  end if;

  update public.knowledge_sources
  set is_active = false,
      status = 'disabled',
      updated_at = now()
  where id = p_source_id;

  update public.knowledge_chunks
  set is_active = false,
      updated_at = now()
  where source_id = p_source_id
    and is_active = true;

  insert into public.knowledge_processing_runs (
    clinic_id,
    source_id,
    status,
    created_by,
    finished_at,
    metadata
  )
  values (
    v_source.clinic_id,
    p_source_id,
    'disabled',
    v_user_id,
    now(),
    jsonb_build_object('trigger', 'disable', 'source_type', v_source.source_type)
  );

  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id;

  return v_source;
end;
$$;

-- ---------------------------------------------
-- storage bucket + policies
-- ---------------------------------------------

insert into storage.buckets (id, name, public)
values ('clinic-knowledge', 'clinic-knowledge', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Clinic members can read clinic knowledge objects" on storage.objects;
drop policy if exists "Owners and admins can upload clinic knowledge objects" on storage.objects;
drop policy if exists "Owners and admins can delete clinic knowledge objects" on storage.objects;

create policy "Clinic members can read clinic knowledge objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'clinic-knowledge'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and public.is_clinic_member((split_part(name, '/', 1))::uuid)
  );

create policy "Owners and admins can upload clinic knowledge objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'clinic-knowledge'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and public.has_clinic_role((split_part(name, '/', 1))::uuid, array['owner', 'admin'])
  );

create policy "Owners and admins can update clinic knowledge objects"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'clinic-knowledge'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and public.has_clinic_role((split_part(name, '/', 1))::uuid, array['owner', 'admin'])
  )
  with check (
    bucket_id = 'clinic-knowledge'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and public.has_clinic_role((split_part(name, '/', 1))::uuid, array['owner', 'admin'])
  );

create policy "Owners and admins can delete clinic knowledge objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'clinic-knowledge'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and public.has_clinic_role((split_part(name, '/', 1))::uuid, array['owner', 'admin'])
  );

-- ---------------------------------------------
-- table policies + grants
-- ---------------------------------------------

alter table public.knowledge_source_files enable row level security;
alter table public.faq_entries enable row level security;
alter table public.knowledge_processing_runs enable row level security;

drop policy if exists "Clinic members can read knowledge source files" on public.knowledge_source_files;
drop policy if exists "Owners and admins can manage knowledge source files" on public.knowledge_source_files;

create policy "Clinic members can read knowledge source files"
  on public.knowledge_source_files
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage knowledge source files"
  on public.knowledge_source_files
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read FAQ entries" on public.faq_entries;
drop policy if exists "Owners and admins can manage FAQ entries" on public.faq_entries;

create policy "Clinic members can read FAQ entries"
  on public.faq_entries
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage FAQ entries"
  on public.faq_entries
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

drop policy if exists "Clinic members can read knowledge processing runs" on public.knowledge_processing_runs;
drop policy if exists "Owners and admins can manage knowledge processing runs" on public.knowledge_processing_runs;

create policy "Clinic members can read knowledge processing runs"
  on public.knowledge_processing_runs
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy "Owners and admins can manage knowledge processing runs"
  on public.knowledge_processing_runs
  for all
  to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

revoke all on public.knowledge_source_files from anon;
revoke all on public.faq_entries from anon;
revoke all on public.knowledge_processing_runs from anon;

grant select, insert, update, delete on public.knowledge_source_files to authenticated;
grant select, insert, update, delete on public.faq_entries to authenticated;
grant select, insert, update, delete on public.knowledge_processing_runs to authenticated;

revoke all on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) to authenticated;

revoke all on function public.disable_knowledge_source(uuid) from public;
grant execute on function public.disable_knowledge_source(uuid) to authenticated;
