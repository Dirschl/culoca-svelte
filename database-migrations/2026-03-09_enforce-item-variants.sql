BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS admin_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_items_admin_hidden
  ON public.items (admin_hidden)
  WHERE admin_hidden = true;

CREATE OR REPLACE FUNCTION public.validate_item_variant_root()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_root_parent_id uuid;
  target_root_exists boolean;
  has_children boolean;
BEGIN
  IF NEW.group_root_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.group_root_item_id = NEW.id THEN
    RAISE EXCEPTION 'An item cannot be its own variant root';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.items
    WHERE id = NEW.group_root_item_id
  )
  INTO target_root_exists;

  IF NOT target_root_exists THEN
    RAISE EXCEPTION 'Variant root item does not exist';
  END IF;

  SELECT group_root_item_id
  INTO target_root_parent_id
  FROM public.items
  WHERE id = NEW.group_root_item_id;

  IF target_root_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Variant root must be a top-level item';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.items
    WHERE group_root_item_id = NEW.id
      AND id <> NEW.id
  )
  INTO has_children;

  IF has_children THEN
    RAISE EXCEPTION 'Parent items cannot become children without reparenting their variants first';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_item_variant_root ON public.items;
CREATE TRIGGER trg_validate_item_variant_root
BEFORE INSERT OR UPDATE OF group_root_item_id
ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.validate_item_variant_root();

COMMIT;
