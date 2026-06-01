-- =============================================
-- Hard delete for knowledge sources + source count limit
-- =============================================
-- Adds:
--   1. delete_knowledge_source RPC (SECURITY DEFINER) for true hard delete
--   2. CASCADE already exists on knowledge_chunks, knowledge_source_files,
--      knowledge_processing_runs (all ON DELETE CASCADE on source_id)
--   3. faq_entries.knowledge_source_id ON DELETE SET NULL (FAQ survives)

create or replace function public.delete_knowledge_source(
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.knowledge_sources;
  v_deleted_chunks int := 0;
  v_deleted_files int := 0;
  v_deleted_runs int := 0;
  v_storage_path text;
  v_file_name text;
begin
  -- 1. Auth check
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- 2. Lock and fetch the source row
  select *
  into v_source
  from public.knowledge_sources
  where id = p_source_id
  for update;

  if v_source.id is null then
    raise exception 'Knowledge source not found.';
  end if;

  -- 3. Role check (same pattern as disable_knowledge_source)
  if not public.has_clinic_role(v_source.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to manage this knowledge source.';
  end if;

  -- 4. Collect file metadata for storage cleanup (before CASCADE removes it)
  -- NOTE: knowledge_source_files has a UNIQUE constraint on source_id (from the
  -- upsert onConflict: 'source_id'), so each source has at most one file.
  -- If this constraint is ever relaxed, this must be changed to collect ALL files.
  select sf.storage_path, sf.file_name
  into v_storage_path, v_file_name
  from public.knowledge_source_files sf
  where sf.source_id = p_source_id
  limit 1;

  -- 5. Count what will be deleted (for audit log)
  select count(*) into v_deleted_chunks
  from public.knowledge_chunks
  where source_id = p_source_id;

  select count(*) into v_deleted_files
  from public.knowledge_source_files
  where source_id = p_source_id;

  select count(*) into v_deleted_runs
  from public.knowledge_processing_runs
  where source_id = p_source_id;

  -- 6. Hard delete the source row
  -- CASCADE automatically deletes:
  --   - knowledge_chunks (ON DELETE CASCADE)
  --   - knowledge_source_files (ON DELETE CASCADE)
  --   - knowledge_processing_runs (ON DELETE CASCADE)
  -- SET NULL automatically handles:
  --   - faq_entries.knowledge_source_id (ON DELETE SET NULL)
  delete from public.knowledge_sources
  where id = p_source_id;

  -- 7. Return audit info + storage path for cleanup
  return jsonb_build_object(
    'deletedSourceId', p_source_id,
    'clinicId', v_source.clinic_id,
    'sourceType', v_source.source_type,
    'deletedChunks', v_deleted_chunks,
    'deletedFiles', v_deleted_files,
    'deletedRuns', v_deleted_runs,
    'storagePath', v_storage_path,
    'fileName', v_file_name,
    'bucketName', case when v_storage_path is not null then 'clinic-knowledge' else null end
  );
end;
$$;

-- Grant execute to authenticated users only
revoke all on function public.delete_knowledge_source(uuid) from public;
grant execute on function public.delete_knowledge_source(uuid) to authenticated;
