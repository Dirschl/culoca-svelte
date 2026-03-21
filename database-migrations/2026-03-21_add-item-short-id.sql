BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS short_id text;

CREATE OR REPLACE FUNCTION public.generate_item_short_id(source_uuid uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT substring(encode(digest(source_uuid::text, 'sha256'), 'hex') from 1 for 10);
$$;

CREATE OR REPLACE FUNCTION public.ensure_item_short_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.short_id IS NULL OR btrim(NEW.short_id) = '' THEN
    NEW.short_id := public.generate_item_short_id(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.items
SET short_id = public.generate_item_short_id(id)
WHERE short_id IS NULL OR btrim(short_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_short_id_unique
  ON public.items(short_id)
  WHERE short_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ensure_item_short_id ON public.items;
CREATE TRIGGER trg_ensure_item_short_id
BEFORE INSERT ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.ensure_item_short_id();

COMMIT;
