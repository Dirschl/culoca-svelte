CREATE UNIQUE INDEX IF NOT EXISTS idx_items_group_slug_unique
ON public.items (lower(group_slug))
WHERE group_slug IS NOT NULL AND btrim(group_slug) <> '';
