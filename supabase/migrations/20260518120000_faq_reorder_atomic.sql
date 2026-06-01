-- Atomic FAQ reorder: swap sort_order of two FAQ entries in a single transaction.
-- Prevents race conditions from two sequential PATCH calls.

create or replace function public.swap_faq_sort_order(
  p_clinic_id uuid,
  p_first_id uuid,
  p_second_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_first_order integer;
  v_second_order integer;
  v_rows integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_clinic_role(p_clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to reorder FAQs for this clinic.';
  end if;

  select count(*)
  into v_rows
  from public.faq_entries
  where clinic_id = p_clinic_id
    and id in (p_first_id, p_second_id);

  if v_rows <> 2 then
    raise exception 'FAQ not found.';
  end if;

  -- Lock both rows in deterministic order to avoid deadlocks between concurrent swaps.
  perform 1
  from public.faq_entries
  where clinic_id = p_clinic_id
    and id in (p_first_id, p_second_id)
  order by id
  for update;

  select sort_order
  into v_first_order
  from public.faq_entries
  where clinic_id = p_clinic_id
    and id = p_first_id;

  select sort_order
  into v_second_order
  from public.faq_entries
  where clinic_id = p_clinic_id
    and id = p_second_id;

  update public.faq_entries
  set sort_order = case
    when id = p_first_id then v_second_order
    when id = p_second_id then v_first_order
    else sort_order
  end,
      updated_at = now()
  where clinic_id = p_clinic_id
    and id in (p_first_id, p_second_id);
end;
$$;

grant execute on function public.swap_faq_sort_order(uuid, uuid, uuid) to authenticated;
