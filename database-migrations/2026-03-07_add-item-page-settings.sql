ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS page_settings jsonb;

UPDATE public.items
SET page_settings = '{}'::jsonb
WHERE page_settings IS NULL;

ALTER TABLE public.items
  ALTER COLUMN page_settings SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_page_settings_is_object'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_page_settings_is_object
      CHECK (page_settings IS NULL OR jsonb_typeof(page_settings) = 'object');
  END IF;
END $$;
