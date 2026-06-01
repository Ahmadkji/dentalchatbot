alter table public.clinics
  add column if not exists default_currency text not null default 'USD'
  check (default_currency ~ '^[A-Z]{3}$');

update public.clinics
set default_currency = upper(trim(default_currency))
where default_currency <> upper(trim(default_currency));

alter table public.services
  add column if not exists price_type text,
  add column if not exists price_min_amount numeric(10, 2),
  add column if not exists price_max_amount numeric(10, 2),
  add column if not exists is_price_visible_to_chatbot boolean not null default false,
  add column if not exists requires_consultation boolean not null default false;

update public.services
set
  price_type = case
    when price_type is not null then price_type
    when price_amount is not null then 'fixed'
    else 'quote_required'
  end,
  is_price_visible_to_chatbot = case
    when price_amount is not null then true
    else false
  end
where price_type is null;

alter table public.services
  alter column price_type set default 'fixed',
  alter column price_type set not null;

alter table public.services
  drop constraint if exists services_price_type_check,
  add constraint services_price_type_check
    check (price_type in ('fixed', 'starting_from', 'range', 'free', 'quote_required')),
  drop constraint if exists services_price_min_amount_check,
  add constraint services_price_min_amount_check
    check (price_min_amount is null or price_min_amount >= 0),
  drop constraint if exists services_price_max_amount_check,
  add constraint services_price_max_amount_check
    check (price_max_amount is null or price_max_amount >= 0),
  drop constraint if exists services_price_type_amounts_check,
  add constraint services_price_type_amounts_check check (
    (
      price_type = 'fixed'
      and price_amount is not null
      and price_min_amount is null
      and price_max_amount is null
    )
    or (
      price_type = 'starting_from'
      and price_amount is not null
      and price_min_amount is null
      and price_max_amount is null
    )
    or (
      price_type = 'range'
      and price_amount is null
      and price_min_amount is not null
      and price_max_amount is not null
      and price_max_amount >= price_min_amount
    )
    or (
      price_type = 'free'
      and price_amount is null
      and price_min_amount is null
      and price_max_amount is null
    )
    or (
      price_type = 'quote_required'
      and price_min_amount is null
      and price_max_amount is null
    )
  );

create or replace view public.clinic_ai_profile_view
with (security_invoker = true)
as
select
  c.id as clinic_id,
  c.name,
  c.slug,
  c.country,
  c.city,
  c.address,
  c.timezone,
  c.phone,
  c.whatsapp,
  c.website_url,
  c.map_link,
  c.pricing_notes,
  c.appointment_rules,
  c.emergency_instructions,
  c.profile_completed,
  c.is_live,
  c.status,
  bs.bot_name,
  bs.tone,
  bs.fallback_message,
  bs.medical_disclaimer,
  bs.emergency_message,
  bs.appointment_mode,
  bs.whatsapp_handoff_enabled,
  bs.lead_capture_enabled,
  ws.enabled as widget_enabled,
  ws.widget_title,
  ws.welcome_message,
  ws.primary_color,
  ws.position as widget_position,
  ws.show_whatsapp_button,
  ws.show_call_button,
  ws.show_location_button,
  ws.allowed_domains,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'day_of_week', ch.day_of_week,
          'is_open', ch.is_open,
          'open_time', to_char(ch.open_time, 'HH24:MI'),
          'close_time', to_char(ch.close_time, 'HH24:MI'),
          'break_start_time', case when ch.break_start_time is null then null else to_char(ch.break_start_time, 'HH24:MI') end,
          'break_end_time', case when ch.break_end_time is null then null else to_char(ch.break_end_time, 'HH24:MI') end,
          'notes', ch.notes
        )
        order by ch.day_of_week
      )
      from public.clinic_hours ch
      where ch.clinic_id = c.id
    ),
    '[]'::jsonb
  ) as clinic_hours,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'category', s.category,
          'price_type', s.price_type,
          'price_amount', s.price_amount,
          'price_min_amount', s.price_min_amount,
          'price_max_amount', s.price_max_amount,
          'price_currency', s.price_currency,
          'pricing_note', s.pricing_note,
          'is_price_visible_to_chatbot', s.is_price_visible_to_chatbot,
          'requires_consultation', s.requires_consultation,
          'duration_minutes', s.duration_minutes,
          'sort_order', s.sort_order
        )
        order by s.sort_order, s.name
      )
      from public.services s
      where s.clinic_id = c.id
        and s.is_active
    ),
    '[]'::jsonb
  ) as active_services,
  c.default_currency
from public.clinics c
left join public.bot_settings bs on bs.clinic_id = c.id
left join public.widget_settings ws on ws.clinic_id = c.id;

grant select on public.clinic_ai_profile_view to authenticated;
