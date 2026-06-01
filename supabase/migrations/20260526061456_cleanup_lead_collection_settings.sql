-- Remove legacy prompt-based lead settings now that chat lead intake is fixed to
-- name + email + phone before the conversation starts.
--
-- Keep the live lead collection toggles and notification settings:
--   - lead_collection_enabled
--   - lead_notifications_enabled
--   - lead_notification_emails

delete from public.clinic_settings
where category = 'lead-collection'
  and key in (
    'lead_collect_email',
    'lead_collect_name',
    'lead_collect_phone',
    'lead_trigger_mode',
    'lead_trigger_message_count',
    'lead_trigger_keywords',
    'lead_auto_escalation'
  );
