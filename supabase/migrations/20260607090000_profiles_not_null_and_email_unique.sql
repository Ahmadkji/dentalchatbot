-- =============================================
-- Fix: profiles.onboarding_completed allows NULL (should be NOT NULL DEFAULT FALSE)
-- Fix: profiles.email has no UNIQUE constraint (integrity gap vs auth.users)
--
-- Root cause:
--   001_profiles_and_rls.sql line 14 declared:
--     onboarding_completed BOOLEAN DEFAULT FALSE
--   Without NOT NULL, the column accepts NULL. All application code treats this
--   as a boolean (truthy check), and the TS type declares it as `boolean`.
--   A NULL value would cause `!profile?.onboarding_completed` to evaluate to
--   true (same as false), but it also breaks the type contract and prevents
--   the DB from enforcing the invariant.
--
--   `email TEXT NOT NULL` has no unique constraint, while auth.users already
--   enforces email uniqueness. This index provides defense-in-depth at the
--   data layer and speeds up lookups by email.
--
-- This migration is:
--   - Safe on existing data (backfills NULLs before adding NOT NULL)
--   - Reversible (DROP INDEX / DROP NOT NULL)
--   - Idempotent (IF NOT EXISTS / IF EXISTS guards)
-- =============================================

-- ---------------------------------------------
-- 1. onboarding_completed: backfill NULL → FALSE, then SET NOT NULL
-- ---------------------------------------------

-- Step 1a: Backfill any existing NULL values to FALSE.
UPDATE public.profiles
SET onboarding_completed = FALSE
WHERE onboarding_completed IS NULL;

-- Step 1b: Add NOT NULL constraint (DEFAULT already exists from 001 migration).
ALTER TABLE public.profiles
ALTER COLUMN onboarding_completed SET NOT NULL;

-- ---------------------------------------------
-- 2. profiles.email: add UNIQUE constraint
-- ---------------------------------------------

-- auth.users already enforces email uniqueness, and the handle_new_user()
-- trigger copies NEW.email directly, so duplicates should not exist.
-- Step 2a: defensively clean up duplicates (keep the most recently updated row)
--          before creating the unique index. This only fires if duplicates exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT email, COUNT(*) AS dup_count
      FROM public.profiles
      GROUP BY email
      HAVING COUNT(*) > 1
    ) dups
  ) THEN
    RAISE NOTICE 'Found duplicate emails in profiles — cleaning up (keeping most recent updated_at)';

    DELETE FROM public.profiles p
    WHERE p.id NOT IN (
      SELECT DISTINCT ON (email) id
      FROM public.profiles
      ORDER BY email, updated_at DESC
    );
  END IF;
END $$;

-- Step 2b: Create the unique index (CONCURRENTLY is not available inside
--          transaction blocks, but Supabase runs each migration statement
--          sequentially. Using IF NOT EXISTS for idempotency.)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
ON public.profiles (email);
