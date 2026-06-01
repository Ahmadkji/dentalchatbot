create or replace function public.resolve_unanswered_question_atomic(
  p_clinic_id uuid,
  p_question_id uuid,
  p_status text default null,
  p_answer text default null,
  p_add_to_faq boolean default false
)
returns table (
  id uuid,
  clinic_id uuid,
  conversation_id uuid,
  question text,
  source_page text,
  status text,
  answer text,
  created_at timestamptz,
  updated_at timestamptz,
  faq_entry_id uuid,
  faq_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_unanswered public.unanswered_questions%rowtype;
  v_effective_answer text;
  v_next_sort int;
  v_faq_id uuid;
  v_faq_created boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Not allowed to manage this clinic.' using errcode = '42501';
  end if;

  select uq.*
  into v_unanswered
  from public.unanswered_questions uq
  where uq.id = p_question_id
    and uq.clinic_id = p_clinic_id
  for update;

  if v_unanswered.id is null then
    raise exception 'Question not found.';
  end if;

  if p_status is not null and p_status not in ('open', 'answered', 'ignored') then
    raise exception 'Invalid status value.';
  end if;

  p_answer := nullif(trim(coalesce(p_answer, '')), '');
  v_effective_answer := coalesce(p_answer, v_unanswered.answer);

  if p_add_to_faq then
    if not public.has_clinic_role(p_clinic_id, array['owner', 'admin']) then
      raise exception 'Only owners and admins can add FAQs.' using errcode = '42501';
    end if;

    if v_effective_answer is null then
      raise exception 'Answer is required to add to FAQ.';
    end if;
  end if;

  update public.unanswered_questions uq
  set status = coalesce(p_status, uq.status),
      answer = case when p_answer is null then uq.answer else p_answer end,
      updated_at = now()
  where uq.id = p_question_id
    and uq.clinic_id = p_clinic_id
  returning * into v_unanswered;

  if p_add_to_faq then
    select fe.id
    into v_faq_id
    from public.faq_entries fe
    where fe.clinic_id = p_clinic_id
      and lower(trim(fe.question)) = lower(trim(v_unanswered.question))
      and lower(trim(fe.answer)) = lower(trim(v_effective_answer))
    order by fe.created_at desc
    limit 1;

    if v_faq_id is null then
      perform pg_advisory_xact_lock(hashtext(p_clinic_id::text));

      select coalesce(max(sort_order), 0) + 1
      into v_next_sort
      from public.faq_entries
      where clinic_id = p_clinic_id;

      insert into public.faq_entries (
        clinic_id,
        question,
        answer,
        category,
        is_active,
        sort_order,
        created_by
      )
      values (
        p_clinic_id,
        v_unanswered.question,
        v_effective_answer,
        null,
        true,
        v_next_sort,
        v_user_id
      )
      returning id into v_faq_id;

      v_faq_created := true;
    end if;
  end if;

  return query
  select
    v_unanswered.id,
    v_unanswered.clinic_id,
    v_unanswered.conversation_id,
    v_unanswered.question,
    v_unanswered.source_page,
    v_unanswered.status,
    v_unanswered.answer,
    v_unanswered.created_at,
    v_unanswered.updated_at,
    v_faq_id,
    v_faq_created;
end;
$$;

revoke all on function public.resolve_unanswered_question_atomic(uuid, uuid, text, text, boolean) from public;
grant execute on function public.resolve_unanswered_question_atomic(uuid, uuid, text, text, boolean) to authenticated;
