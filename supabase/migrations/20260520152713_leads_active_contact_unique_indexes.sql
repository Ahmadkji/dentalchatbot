-- Make active lead duplicate prevention atomic at the database layer.
--
-- The current trigger catches normal duplicates, but concurrent inserts can
-- still race because the EXISTS check is not a true uniqueness guarantee.
-- These partial unique indexes enforce uniqueness only for non-spam leads,
-- which matches the production workflow and the existing trigger logic.

do $$
begin
  if exists (
    select 1
    from (
      select clinic_id, public.normalize_phone_digits(phone)
      from public.leads
      where status <> 'spam'
      group by clinic_id, public.normalize_phone_digits(phone)
      having public.normalize_phone_digits(phone) is not null and count(*) > 1
    ) phone_dupes
  ) then
    raise exception 'Cannot create active lead phone unique index until duplicate non-spam phone leads are cleaned up.';
  end if;

  if exists (
    select 1
    from (
      select clinic_id, public.normalize_email_value(email)
      from public.leads
      where status <> 'spam' and email is not null and trim(email) <> ''
      group by clinic_id, public.normalize_email_value(email)
      having public.normalize_email_value(email) is not null and count(*) > 1
    ) email_dupes
  ) then
    raise exception 'Cannot create active lead email unique index until duplicate non-spam email leads are cleaned up.';
  end if;
end
$$;

drop index if exists public.idx_leads_clinic_phone_digits;
create unique index if not exists idx_leads_clinic_phone_active_unique
  on public.leads (clinic_id, public.normalize_phone_digits(phone))
  where status <> 'spam';

drop index if exists public.idx_leads_clinic_email;
create unique index if not exists idx_leads_clinic_email_active_unique
  on public.leads (clinic_id, public.normalize_email_value(email))
  where status <> 'spam' and email is not null and trim(email) <> '';
