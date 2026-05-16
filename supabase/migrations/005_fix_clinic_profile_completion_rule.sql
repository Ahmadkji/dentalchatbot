create or replace function public.refresh_clinic_profile_status(p_clinic_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed boolean;
begin
  select
    c.phone is not null
    and char_length(trim(coalesce(c.address, ''))) > 0
    and char_length(trim(coalesce(c.emergency_instructions, ''))) > 0
    and exists (
      select 1
      from public.clinic_hours ch
      where ch.clinic_id = c.id
        and (ch.is_open or char_length(trim(coalesce(ch.notes, ''))) > 0)
    )
    and exists (
      select 1
      from public.services s
      where s.clinic_id = c.id
        and s.is_active
    )
  into v_completed
  from public.clinics c
  where c.id = p_clinic_id;

  update public.clinics
  set profile_completed = coalesce(v_completed, false)
  where id = p_clinic_id;

  return coalesce(v_completed, false);
end;
$$;

select public.refresh_clinic_profile_status(id)
from public.clinics;
