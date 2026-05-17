-- Distributed token-bucket rate limiting.
-- Called from server routes via supabase.rpc('consume_rate_limit', {...}).
-- Only the service_role can execute this function.

-- 1. Table: one row per bucket key
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  tokens numeric not null,
  capacity int not null check (capacity > 0),
  refill_per_sec numeric not null check (refill_per_sec > 0),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null
);

-- Index for cleanup cron (delete where expires_at < now)
create index if not exists idx_rate_limit_buckets_expires_at
  on public.rate_limit_buckets (expires_at);

-- 2. RLS: service_role only
alter table public.rate_limit_buckets enable row level security;

drop policy if exists "Service role full access on rate_limit_buckets" on public.rate_limit_buckets;
create policy "Service role full access on rate_limit_buckets"
  on public.rate_limit_buckets for all
  to service_role using (true) with check (true);

-- 3. Token-bucket consume function
--    Atomically: upsert bucket → refill → check → deduct (or reject).
--    INSERT ... ON CONFLICT takes an exclusive row lock, so the
--    subsequent UPDATE is serialized — no TOCTOU race.
create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_capacity int,
  p_refill_per_sec numeric,
  p_cost numeric default 1
) returns table(allowed boolean, remaining numeric, reset_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_tokens numeric;
begin
  -- Upsert: create full bucket, or refill existing
  insert into public.rate_limit_buckets as b
    (bucket_key, tokens, capacity, refill_per_sec, updated_at, expires_at)
  values
    (p_bucket_key, p_capacity, p_capacity, p_refill_per_sec, v_now, v_now + interval '1 day')
  on conflict (bucket_key) do update set
    tokens = least(
      p_capacity::numeric,
      b.tokens + greatest(0, extract(epoch from (v_now - b.updated_at))) * b.refill_per_sec
    ),
    capacity     = p_capacity,
    refill_per_sec = p_refill_per_sec,
    updated_at   = v_now,
    expires_at   = v_now + interval '1 day'
  returning b.tokens into v_tokens;

  if v_tokens >= p_cost then
    -- Deduct and return allowed = true
    update public.rate_limit_buckets
    set tokens     = v_tokens - p_cost,
        updated_at = v_now,
        expires_at = v_now + interval '1 day'
    where bucket_key = p_bucket_key
    returning
      true,
      tokens,
      v_now + make_interval(secs => ceil((p_capacity::numeric - tokens) / p_refill_per_sec)::bigint)
    into allowed, remaining, reset_at;
  else
    -- Not enough tokens — reject
    allowed   := false;
    remaining := v_tokens;
    reset_at  := v_now + make_interval(secs => ceil((p_cost - v_tokens) / p_refill_per_sec)::bigint);
  end if;

  return next;
end;
$$;

-- 4. Revoke from all roles, grant only to service_role
revoke execute on function public.consume_rate_limit(text,int,numeric,numeric)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,int,numeric,numeric)
  to service_role;

-- 5. Cleanup: delete expired buckets.
--    Run via pg_cron or manually:
--    SELECT cron.schedule(
--      'cleanup-rate-limit-buckets',
--      '0 * * * *',
--      $$ DELETE FROM public.rate_limit_buckets WHERE expires_at < now() $$
--    );
