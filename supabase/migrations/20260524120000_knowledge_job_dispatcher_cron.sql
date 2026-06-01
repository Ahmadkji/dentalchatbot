-- Durable knowledge job dispatcher schedule.
-- This keeps the existing queue/dispatcher/runner architecture unchanged.

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
   where jobname = 'knowledge-job-dispatcher-every-minute'
   limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'knowledge-job-dispatcher-every-minute',
    '* * * * *',
    $job$
    do $dispatch$
    declare
      v_project_url text;
      v_dispatcher_secret text;
    begin
      select decrypted_secret
        into v_project_url
        from vault.decrypted_secrets
       where name = 'project_url'
       limit 1;

      select decrypted_secret
        into v_dispatcher_secret
        from vault.decrypted_secrets
       where name = 'knowledge_dispatcher_secret'
       limit 1;

      if v_project_url is null or v_dispatcher_secret is null then
        return;
      end if;

      perform net.http_post(
        url := v_project_url || '/functions/v1/knowledge-job-dispatcher',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-knowledge-dispatcher-secret', v_dispatcher_secret
        ),
        body := '{}'::jsonb
      );
    end
    $dispatch$;
    $job$
  );
end
$$;
