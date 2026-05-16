Set these secrets before deploying the dispatcher:

- `KNOWLEDGE_DISPATCHER_SECRET`
- `KNOWLEDGE_JOB_RUNNER_SECRET`
- `KNOWLEDGE_JOB_RUNNER_URL`

Example cron payload:

```sql
select
  cron.schedule(
    'knowledge-job-dispatcher-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url := 'https://<project-ref>.functions.supabase.co/knowledge-job-dispatcher',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-knowledge-dispatcher-secret', '<dispatcher-secret>'
        ),
        body := '{}'::jsonb
      );
    $$
  );
```
