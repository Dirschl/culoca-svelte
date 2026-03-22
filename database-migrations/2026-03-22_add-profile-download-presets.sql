BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS download_presets jsonb;

COMMIT;
