-- Phase 6: Broaden interaction_events.event_type to support widget lifecycle analytics
-- This migration drops the old narrow CHECK constraint and adds a broader one.

-- Drop old constraint (named by Postgres convention: interaction_events_event_type_check)
alter table public.interaction_events
  drop constraint if exists interaction_events_event_type_check;

-- Add new broader constraint with widget lifecycle events
alter table public.interaction_events
  add constraint interaction_events_event_type_check
  check (event_type in (
    -- Legacy events
    'whatsapp_click',
    'call_click',
    'location_click',
    'directions_click',
    'appointment_request',
    -- New widget lifecycle events
    'widget_loaded',
    'widget_opened',
    'widget_closed',
    'quick_prompt_clicked',
    'message_sent',
    'answer_received',
    'whatsapp_clicked',
    'maps_clicked'
  ));

-- Add index for widget event queries by clinic + time
create index if not exists idx_interaction_events_clinic_created
  on public.interaction_events(clinic_id, created_at desc);
