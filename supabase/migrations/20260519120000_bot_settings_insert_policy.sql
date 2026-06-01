-- =============================================
-- Fix: Add INSERT RLS policy and grant on bot_settings
-- The customizations PUT handler uses upsert on bot_settings,
-- but only SELECT and UPDATE policies/grants existed.
-- When the row is missing, upsert becomes INSERT and was blocked.
-- =============================================

-- Add INSERT RLS policy for owners and admins
drop policy if exists "Owners and admins can insert bot settings" on public.bot_settings;

create policy "Owners and admins can insert bot settings"
  on public.bot_settings
  for insert
  to authenticated
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']));

-- Add INSERT grant
grant insert on public.bot_settings to authenticated;
