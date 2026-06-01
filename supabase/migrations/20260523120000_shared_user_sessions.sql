-- Shared session registry for auth login/logout tracking.
-- This replaces the in-memory Maps in src/lib/security.ts with
-- a small service-role-only table so multiple app instances stay in sync.

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null unique,
  ip text not null default 'unknown',
  user_agent text not null default 'unknown',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_user_sessions_user_id_created_at
  on public.user_sessions (user_id, created_at desc);

alter table public.user_sessions enable row level security;

drop policy if exists "Service role full access on user_sessions" on public.user_sessions;
create policy "Service role full access on user_sessions"
  on public.user_sessions
  for all
  to service_role
  using (true)
  with check (true);

drop trigger if exists user_sessions_updated_at on public.user_sessions;
create trigger user_sessions_updated_at
  before update on public.user_sessions
  for each row execute function public.set_updated_at();

create or replace function public.register_user_session(
  p_user_id uuid,
  p_session_key text,
  p_ip text default 'unknown',
  p_user_agent text default 'unknown',
  p_max_sessions int default 5
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session_key text := nullif(trim(coalesce(p_session_key, '')), '');
  v_ip text := left(coalesce(nullif(trim(coalesce(p_ip, '')), ''), 'unknown'), 128);
  v_user_agent text := left(coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), 'unknown'), 512);
  v_max_sessions int := greatest(coalesce(p_max_sessions, 1), 1);
begin
  if v_session_key is null then
    raise exception 'Session key is required.';
  end if;

  insert into public.user_sessions as us (
    user_id,
    session_key,
    ip,
    user_agent
  )
  values (
    p_user_id,
    v_session_key,
    v_ip,
    v_user_agent
  )
  on conflict (session_key) do update set
    user_id = excluded.user_id,
    ip = excluded.ip,
    user_agent = excluded.user_agent;

  delete from public.user_sessions
  where id in (
    select id
    from public.user_sessions
    where user_id = p_user_id
    order by created_at desc, updated_at desc, session_key desc
    offset v_max_sessions
  );
end;
$$;

revoke execute on function public.register_user_session(uuid, text, text, text, int)
  from public, anon, authenticated;
grant execute on function public.register_user_session(uuid, text, text, text, int)
  to service_role;
