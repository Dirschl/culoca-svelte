-- Idempotent migration for newsflash_mode on profiles
-- Safe to run multiple times

-- 1) Ensure column exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS newsflash_mode TEXT;

-- 2) Ensure new default is "aus"
ALTER TABLE profiles
ALTER COLUMN newsflash_mode SET DEFAULT 'aus';

-- 3) Normalize existing values
UPDATE profiles
SET newsflash_mode = 'aus'
WHERE newsflash_mode IS NULL
   OR newsflash_mode NOT IN ('aus', 'eigene', 'alle');

-- 4) Ensure there is at least one check constraint for allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'profiles'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%newsflash_mode%'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_newsflash_mode_check
      CHECK (newsflash_mode IN ('aus', 'eigene', 'alle'));
  END IF;
END $$;
