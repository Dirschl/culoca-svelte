BEGIN;

ALTER TABLE public.item_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid NULL REFERENCES public.item_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_item_comments_parent_created_at
  ON public.item_comments(parent_comment_id, created_at ASC);

COMMIT;
