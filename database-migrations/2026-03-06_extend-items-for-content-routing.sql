BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS group_root_item_id uuid,
  ADD COLUMN IF NOT EXISTS group_slug text,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS show_in_main_feed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canonical_path text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_group_root_item_id_fkey;

ALTER TABLE public.items
  ADD CONSTRAINT items_group_root_item_id_fkey
  FOREIGN KEY (group_root_item_id)
  REFERENCES public.items(id)
  ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_group_root_item_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_group_root_item_check
      CHECK (group_root_item_id IS NULL OR group_root_item_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_group_root_item_id ON public.items(group_root_item_id);
CREATE INDEX IF NOT EXISTS idx_items_group_slug ON public.items(group_slug) WHERE group_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_canonical_path ON public.items(canonical_path) WHERE canonical_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_main_feed ON public.items(show_in_main_feed) WHERE show_in_main_feed = true;

CREATE OR REPLACE FUNCTION public.refresh_item_canonical_path(target_item_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item_row public.items%ROWTYPE;
  root_row public.items%ROWTYPE;
  type_slug text;
  computed_path text;
BEGIN
  SELECT * INTO item_row
  FROM public.items
  WHERE id = target_item_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT slug INTO type_slug
  FROM public.types
  WHERE id = item_row.type_id;

  IF item_row.group_root_item_id IS NOT NULL THEN
    SELECT * INTO root_row
    FROM public.items
    WHERE id = item_row.group_root_item_id;
  ELSE
    root_row := item_row;
  END IF;

  IF item_row.slug IS NULL OR type_slug IS NULL THEN
    computed_path := NULL;
  ELSIF item_row.group_root_item_id IS NULL AND item_row.group_slug IS NOT NULL THEN
    computed_path := '/' || type_slug || '/' || item_row.group_slug;
  ELSIF item_row.group_root_item_id IS NOT NULL AND root_row.group_slug IS NOT NULL THEN
    computed_path := '/' || type_slug || '/' || root_row.group_slug || '/' || item_row.slug;
  ELSE
    computed_path := '/' || type_slug || '/' || item_row.slug;
  END IF;

  UPDATE public.items
  SET canonical_path = computed_path
  WHERE id = item_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_item_canonical_paths()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  child_record record;
BEGIN
  PERFORM public.refresh_item_canonical_path(NEW.id);

  IF TG_OP = 'UPDATE' THEN
    FOR child_record IN
      SELECT id
      FROM public.items
      WHERE group_root_item_id = COALESCE(NEW.id, OLD.id)
    LOOP
      PERFORM public.refresh_item_canonical_path(child_record.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_item_canonical_paths ON public.items;
CREATE TRIGGER trg_sync_item_canonical_paths
AFTER INSERT OR UPDATE OF slug, type_id, group_root_item_id, group_slug
ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.sync_item_canonical_paths();

CREATE OR REPLACE FUNCTION public.sync_type_canonical_paths()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_record record;
BEGIN
  FOR item_record IN
    SELECT id
    FROM public.items
    WHERE type_id = NEW.id
  LOOP
    PERFORM public.refresh_item_canonical_path(item_record.id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_type_canonical_paths ON public.types;
CREATE TRIGGER trg_sync_type_canonical_paths
AFTER UPDATE OF slug
ON public.types
FOR EACH ROW
EXECUTE FUNCTION public.sync_type_canonical_paths();

UPDATE public.items
SET show_in_main_feed = true
WHERE show_in_main_feed IS NULL;

DO $$
DECLARE
  item_record record;
BEGIN
  FOR item_record IN
    SELECT id
    FROM public.items
  LOOP
    PERFORM public.refresh_item_canonical_path(item_record.id);
  END LOOP;
END $$;

COMMIT;
