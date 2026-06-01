-- Support configurable pre-chat lead field presets.
--
-- This keeps the existing default of name + email + phone for all clinics,
-- but allows new clinics or updated settings to require name + email or
-- name + phone instead. The leads table must therefore allow nullable phone
-- while still requiring at least one contact method.

insert into public.clinic_settings (
  clinic_id,
  key,
  value,
  category,
  description
)
select
  c.id,
  'lead_required_fields',
  '["name","email","phone"]',
  'lead-collection',
  'Required contact fields visitors must complete before chat starts.'
from public.clinics c
on conflict (clinic_id, key) do update
set
  category = excluded.category,
  description = excluded.description;

alter table public.leads
  alter column phone drop not null;

alter table public.leads
  drop constraint if exists leads_phone_format_check,
  add constraint leads_phone_format_check
    check (
      phone is null
      or (
        public.normalize_phone_digits(phone) is not null
        and char_length(public.normalize_phone_digits(phone)) between 7 and 15
      )
    ),
  drop constraint if exists leads_contact_method_check,
  add constraint leads_contact_method_check
    check (
      public.normalize_phone_digits(phone) is not null
      or public.normalize_email_value(email) is not null
    );

drop index if exists public.idx_leads_clinic_phone_digits;
drop index if exists public.idx_leads_clinic_phone_active_unique;
create unique index if not exists idx_leads_clinic_phone_active_unique
  on public.leads (clinic_id, public.normalize_phone_digits(phone))
  where status <> 'spam' and public.normalize_phone_digits(phone) is not null;
