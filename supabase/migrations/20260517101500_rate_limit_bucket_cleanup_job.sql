do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    select jobid
      into v_job_id
      from cron.job
     where jobname = 'cleanup-rate-limit-buckets'
     limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
      'cleanup-rate-limit-buckets',
      '*/15 * * * *',
      $job$
        delete from public.rate_limit_buckets
        where expires_at < now();
      $job$
    );
  end if;
end
$$;
