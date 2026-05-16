-- =============================================
-- Feature: Public widget session token expiry
-- Adds token expiry + session version to conversations
-- for explicit host-page session handoff.
-- =============================================

-- Token expiry: allows revocation/rotation of public session tokens
alter table public.conversations
  add column if not exists public_token_expires_at timestamptz;

-- Session version: helps future migration of storage key format
alter table public.conversations
  add column if not exists session_version integer not null default 1;

-- Index for efficient expiry lookups
create index if not exists idx_conversations_token_expires
  on public.conversations(public_token_expires_at)
  where public_token_hash is not null and public_token_expires_at is not null;

-- Backfill: set 30-day expiry for existing conversations with tokens
update public.conversations
  set public_token_expires_at = created_at + interval '30 days'
  where public_token_hash is not null
    and public_token_expires_at is null;
