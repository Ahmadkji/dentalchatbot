-- Harden the human handoff queue so delivery is durable, traceable, and safe to retry.
-- This migration is deploy-safe with the existing code:
-- - it expands status values instead of replacing legacy ones
-- - it keeps the old sent_at column for backward compatibility
-- - it adds the scheduler only when Vault + Cron are available

alter table public.human_handoff_requests
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists provider_accepted_at timestamptz,
  add column if not exists provider_delivered_at timestamptz,
  add column if not exists provider_last_event text,
  add column if not exists provider_last_event_at timestamptz;

alter table public.human_handoff_requests
  drop constraint if exists human_handoff_requests_status_check;

alter table public.human_handoff_requests
  add constraint human_handoff_requests_status_check
  check (status in ('queued', 'sending', 'sent', 'accepted', 'delivered', 'failed'));

update public.human_handoff_requests
   set available_at = case
     when status = 'failed' then coalesce(last_attempt_at, created_at, now())
     else coalesce(available_at, created_at, now())
   end,
       provider_accepted_at = coalesce(provider_accepted_at, sent_at),
       provider_last_event = coalesce(
         provider_last_event,
         case when status = 'sent' then 'legacy.sent' else null end
       ),
       provider_last_event_at = coalesce(provider_last_event_at, sent_at, updated_at)
 where true;

create index if not exists idx_human_handoff_requests_queue_available
  on public.human_handoff_requests (status, available_at, created_at)
  where status in ('queued', 'failed');

create index if not exists idx_human_handoff_requests_sending_locked
  on public.human_handoff_requests (status, locked_at)
  where status = 'sending';

create unique index if not exists idx_human_handoff_requests_provider_message
  on public.human_handoff_requests (provider_message_id)
  where provider_message_id is not null;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (
    select 1
      from pg_available_extensions
     where name = 'vault'
  ) then
    create extension if not exists vault;
  end if;
exception
  when insufficient_privilege or feature_not_supported or undefined_file then
    null;
end
$$;

do $$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    return;
  end if;

  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    return;
  end if;

  select jobid
    into v_job_id
    from cron.job
   where jobname = 'human-handoff-runner-every-minute'
   limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'human-handoff-runner-every-minute',
    '* * * * *',
    $job$
    do $dispatch$
    declare
      v_runner_url text;
      v_runner_secret text;
    begin
      select decrypted_secret
        into v_runner_url
        from vault.decrypted_secrets
       where name = 'human_handoff_runner_url'
       limit 1;

      select decrypted_secret
        into v_runner_secret
        from vault.decrypted_secrets
       where name = 'human_handoff_runner_secret'
       limit 1;

      if v_runner_url is null or v_runner_secret is null then
        return;
      end if;

      perform net.http_post(
        url := v_runner_url,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-human-handoff-runner-secret', v_runner_secret
        ),
        body := jsonb_build_object(
          'limit', 5,
          'runner', 'supabase-cron'
        )
      );
    end
    $dispatch$;
    $job$
  );
end
$$;
