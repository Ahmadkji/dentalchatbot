Set these secrets before deploying the dispatcher:

- `KNOWLEDGE_DISPATCHER_SECRET`
- `KNOWLEDGE_JOB_RUNNER_SECRET`
- `KNOWLEDGE_JOB_RUNNER_URL`

For the Supabase Cron migration, also store these Vault secrets:

- `project_url`
- `knowledge_dispatcher_secret`

Example cron payload:

```sql
select
  cron.schedule(
    'knowledge-job-dispatcher-every-minute',
    '* * * * *',
    $$
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
    $$
  );
```
