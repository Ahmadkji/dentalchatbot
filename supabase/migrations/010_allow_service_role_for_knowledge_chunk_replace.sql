-- =============================================
-- Allow service-role workers to process queued knowledge jobs
-- =============================================

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
  v_request_role text := coalesce(auth.jwt() ->> 'role', '');
  v_is_service_role boolean := v_request_role = 'service_role';
  v_source public.knowledge_sources;
  v_chunk jsonb;
  v_run_id uuid;
  v_chunk_count int := 0;
  v_disabled_count int := 0;
begin
  if not v_is_service_role and v_user_id is null then
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

  if not v_is_service_role and not public.has_clinic_role(v_source.clinic_id, array['owner', 'admin']) then
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
    case when v_is_service_role then null else v_user_id end,
    jsonb_build_object(
      'trigger', case when v_is_service_role then 'service-role-worker' else 'sync' end,
      'source_type', v_source.source_type
    )
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

revoke all on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.replace_knowledge_source_chunks(uuid, text, text, text, text, jsonb, timestamptz) to service_role;
