create or replace function public.apply_website_autofill(
  p_session_id uuid,
  p_approvals jsonb default '[]'::jsonb,
  p_clinic_update jsonb default '{}'::jsonb,
  p_widget_update jsonb default '{}'::jsonb,
  p_bot_update jsonb default '{}'::jsonb,
  p_settings_update jsonb default '{}'::jsonb,
  p_hours jsonb default null,
  p_services jsonb default '[]'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.clinic_import_sessions%rowtype;
  v_approval jsonb;
  v_field_id uuid;
  v_approved boolean;
  v_approved_value text;
  v_setting record;
  v_profile_completed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if jsonb_typeof(p_approvals) <> 'array' then
    raise exception 'Import approvals payload must be an array.';
  end if;

  if jsonb_typeof(coalesce(p_clinic_update, '{}'::jsonb)) <> 'object' then
    raise exception 'Clinic import update payload must be an object.';
  end if;

  if jsonb_typeof(coalesce(p_widget_update, '{}'::jsonb)) <> 'object' then
    raise exception 'Widget update payload must be an object.';
  end if;

  if jsonb_typeof(coalesce(p_bot_update, '{}'::jsonb)) <> 'object' then
    raise exception 'Bot update payload must be an object.';
  end if;

  if jsonb_typeof(coalesce(p_settings_update, '{}'::jsonb)) <> 'object' then
    raise exception 'Clinic settings payload must be an object.';
  end if;

  if p_hours is not null and jsonb_typeof(p_hours) <> 'array' then
    raise exception 'Clinic hours payload must be an array.';
  end if;

  if jsonb_typeof(coalesce(p_services, '[]'::jsonb)) <> 'array' then
    raise exception 'Service payload must be an array.';
  end if;

  select *
  into v_session
  from public.clinic_import_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Import session not found.';
  end if;

  if not public.has_clinic_role(v_session.clinic_id, array['owner', 'admin']) then
    raise exception 'Not allowed to apply website autofill.';
  end if;

  if v_session.status = 'cancelled' then
    raise exception 'This import session was cancelled.';
  end if;

  if v_session.status = 'approved' then
    return;
  end if;

  for v_approval in
    select value
    from jsonb_array_elements(p_approvals)
  loop
    v_field_id := nullif(v_approval ->> 'field_id', '')::uuid;
    v_approved := coalesce((v_approval ->> 'approved')::boolean, false);
    v_approved_value := nullif(trim(coalesce(v_approval ->> 'approved_value', '')), '');

    if v_field_id is null then
      raise exception 'Each approval must include a field_id.';
    end if;

    update public.clinic_import_detected_fields
    set
      approved = v_approved,
      approved_value = case
        when v_approved then coalesce(v_approved_value, detected_value)
        else null
      end
    where id = v_field_id
      and import_session_id = p_session_id;

    if not found then
      raise exception 'Import field does not belong to this session.';
    end if;
  end loop;

  update public.clinics
  set
    name = coalesce(nullif(trim(v_clinic_update ->> 'name'), ''), name),
    phone = coalesce(nullif(trim(v_clinic_update ->> 'phone'), ''), phone),
    whatsapp = coalesce(nullif(trim(v_clinic_update ->> 'whatsapp'), ''), whatsapp),
    address = coalesce(nullif(trim(v_clinic_update ->> 'address'), ''), address),
    city = coalesce(nullif(trim(v_clinic_update ->> 'city'), ''), city),
    website_url = coalesce(nullif(trim(v_clinic_update ->> 'website_url'), ''), website_url),
    map_link = coalesce(nullif(trim(v_clinic_update ->> 'map_link'), ''), map_link),
    pricing_notes = coalesce(nullif(trim(v_clinic_update ->> 'pricing_notes'), ''), pricing_notes),
    appointment_rules = coalesce(nullif(trim(v_clinic_update ->> 'appointment_rules'), ''), appointment_rules),
    emergency_instructions = coalesce(nullif(trim(v_clinic_update ->> 'emergency_instructions'), ''), emergency_instructions),
    default_currency = coalesce(nullif(upper(trim(v_clinic_update ->> 'default_currency')), ''), default_currency),
    updated_at = now()
  where id = v_session.clinic_id;

  insert into public.widget_settings (
    clinic_id,
    enabled,
    widget_title,
    welcome_message,
    primary_color,
    position,
    show_whatsapp_button,
    show_call_button,
    show_location_button,
    allowed_domains
  )
  values (
    v_session.clinic_id,
    false,
    coalesce(nullif(trim(v_widget_update ->> 'widget_title'), ''), 'Ask our dental clinic'),
    coalesce(nullif(trim(v_widget_update ->> 'welcome_message'), ''), 'Hi! I can help with clinic hours, location, services, fees, and appointment requests.'),
    coalesce(nullif(trim(v_widget_update ->> 'primary_color'), ''), '#059669'),
    coalesce(nullif(trim(v_widget_update ->> 'position'), ''), 'bottom-right'),
    coalesce((v_widget_update ->> 'show_whatsapp_button')::boolean, true),
    coalesce((v_widget_update ->> 'show_call_button')::boolean, true),
    coalesce((v_widget_update ->> 'show_location_button')::boolean, true),
    case
      when jsonb_typeof(v_widget_update -> 'allowed_domains') = 'array' then
        array(
          select distinct allowed_domain.value
          from jsonb_array_elements_text(v_widget_update -> 'allowed_domains') as allowed_domain(value)
          where nullif(trim(allowed_domain.value), '') is not null
        )
      else '{}'::text[]
    end
  )
  on conflict (clinic_id) do update
    set
      widget_title = excluded.widget_title,
      welcome_message = excluded.welcome_message,
      primary_color = excluded.primary_color,
      position = excluded.position,
      show_whatsapp_button = excluded.show_whatsapp_button,
      show_call_button = excluded.show_call_button,
      show_location_button = excluded.show_location_button,
      allowed_domains = excluded.allowed_domains;

  insert into public.bot_settings (
    clinic_id,
    bot_name,
    tone,
    fallback_message,
    medical_disclaimer,
    emergency_message,
    appointment_mode,
    whatsapp_handoff_enabled,
    lead_capture_enabled
  )
  values (
    v_session.clinic_id,
    coalesce(nullif(trim(v_bot_update ->> 'bot_name'), ''), 'Dental Assistant'),
    coalesce(nullif(trim(v_bot_update ->> 'tone'), ''), 'friendly'),
    coalesce(nullif(trim(v_bot_update ->> 'fallback_message'), ''), 'I''m not sure about that. Please contact the clinic directly for accurate information.'),
    coalesce(nullif(trim(v_bot_update ->> 'medical_disclaimer'), ''), 'I can share clinic information, but I can''t diagnose dental or medical conditions.'),
    coalesce(nullif(trim(v_bot_update ->> 'emergency_message'), ''), 'If this is severe pain, swelling, bleeding, trauma, or breathing difficulty, please contact the clinic or emergency services immediately.'),
    coalesce(nullif(trim(v_bot_update ->> 'appointment_mode'), ''), 'whatsapp'),
    coalesce((v_bot_update ->> 'whatsapp_handoff_enabled')::boolean, true),
    coalesce((v_bot_update ->> 'lead_capture_enabled')::boolean, true)
  )
  on conflict (clinic_id) do update
    set
      bot_name = excluded.bot_name,
      tone = excluded.tone,
      fallback_message = excluded.fallback_message,
      medical_disclaimer = excluded.medical_disclaimer,
      emergency_message = excluded.emergency_message,
      appointment_mode = excluded.appointment_mode,
      whatsapp_handoff_enabled = excluded.whatsapp_handoff_enabled,
      lead_capture_enabled = excluded.lead_capture_enabled;

  for v_setting in
    select key, value
    from jsonb_each_text(coalesce(p_settings_update, '{}'::jsonb))
  loop
    insert into public.clinic_settings (
      clinic_id,
      key,
      value,
      category,
      description
    )
    values (
      v_session.clinic_id,
      v_setting.key,
      coalesce(nullif(trim(v_setting.value), ''), ''),
      case
        when v_setting.key like 'lead_%' then 'lead-collection'
        when v_setting.key in (
          'ai_personality',
          'after_hours_message',
          'auto_reply',
          'faq_enabled',
          'appointment_buffer',
          'max_advance_booking',
          'cancellation_policy',
          'slot_duration'
        ) then 'automation'
        when v_setting.key in (
          'greeting_message',
          'closing_message',
          'emergency_response',
          'parking_info',
          'google_maps_url',
          'bot_disabled_fields',
          'chat_mode',
          'collect_user_details',
          'disable_smart_followup',
          'smart_followup_count'
        ) then 'communication'
        else 'automation'
      end,
      null
    )
    on conflict (clinic_id, key) do update
      set value = excluded.value;
  end loop;

  if p_services is not null and jsonb_array_length(p_services) > 0 then
    insert into public.services (
      clinic_id,
      name,
      description,
      category,
      price_type,
      price_amount,
      price_min_amount,
      price_max_amount,
      price_currency,
      pricing_note,
      duration_minutes,
      is_active,
      sort_order,
      is_price_visible_to_chatbot,
      requires_consultation
    )
    select
      v_session.clinic_id,
      nullif(trim(service_row.name), ''),
      nullif(trim(service_row.description), ''),
      nullif(trim(service_row.category), ''),
      service_row.price_type,
      service_row.price_amount,
      service_row.price_min_amount,
      service_row.price_max_amount,
      upper(nullif(trim(service_row.price_currency), '')),
      nullif(trim(service_row.pricing_note), ''),
      coalesce(service_row.duration_minutes, 1),
      coalesce(service_row.is_active, true),
      coalesce(service_row.sort_order, 100),
      coalesce(service_row.is_price_visible_to_chatbot, false),
      coalesce(service_row.requires_consultation, false)
    from jsonb_to_recordset(p_services) as service_row(
      name text,
      description text,
      category text,
      price_type text,
      price_amount numeric,
      price_min_amount numeric,
      price_max_amount numeric,
      price_currency text,
      pricing_note text,
      duration_minutes integer,
      is_active boolean,
      sort_order integer,
      is_price_visible_to_chatbot boolean,
      requires_consultation boolean
    )
    where nullif(trim(service_row.name), '') is not null
    on conflict (clinic_id, lower(name)) do update
      set
        description = excluded.description,
        category = excluded.category,
        price_type = excluded.price_type,
        price_amount = excluded.price_amount,
        price_min_amount = excluded.price_min_amount,
        price_max_amount = excluded.price_max_amount,
        price_currency = excluded.price_currency,
        pricing_note = excluded.pricing_note,
        duration_minutes = excluded.duration_minutes,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        is_price_visible_to_chatbot = excluded.is_price_visible_to_chatbot,
        requires_consultation = excluded.requires_consultation;
  end if;

  if p_hours is not null then
    perform public.replace_clinic_hours(v_session.clinic_id, p_hours);
  end if;

  v_profile_completed := public.refresh_clinic_profile_status(v_session.clinic_id);

  if v_profile_completed then
    update public.clinics
    set is_live = true
    where id = v_session.clinic_id
      and coalesce(is_live, false) = false
      and status = 'active';

    update public.widget_settings
    set enabled = true
    where clinic_id = v_session.clinic_id
      and coalesce(enabled, false) = false;
  end if;

  update public.clinic_import_sessions
  set
    status = 'approved',
    fetch_status = 'fetched',
    reviewed_at = now(),
    approved_at = now(),
    error_message = p_error_message
  where id = p_session_id;

  insert into public.clinic_profile_audit_logs (
    clinic_id,
    actor_user_id,
    event,
    entity_type,
    metadata
  )
  values (
    v_session.clinic_id,
    v_user_id,
    'clinic_autofill_applied',
    'clinic_profile',
    jsonb_build_object(
      'import_session_id', p_session_id,
      'profile_completed', v_profile_completed,
      'auto_enabled_live', v_profile_completed
    )
  );
end;
$$;

revoke all on function public.apply_website_autofill(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public;
grant execute on function public.apply_website_autofill(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) to authenticated;
