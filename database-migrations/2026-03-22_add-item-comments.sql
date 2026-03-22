BEGIN;

CREATE TABLE IF NOT EXISTS public.item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'visible',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_comments_body_length CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  CONSTRAINT item_comments_status_check CHECK (status IN ('visible', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_item_comments_item_created_at
  ON public.item_comments(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_comments_user_created_at
  ON public.item_comments(user_id, created_at DESC);

ALTER TABLE public.item_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view visible comments" ON public.item_comments;
CREATE POLICY "Anyone can view visible comments" ON public.item_comments
  FOR SELECT USING (status = 'visible' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.item_comments;
CREATE POLICY "Authenticated users can insert comments" ON public.item_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'visible');

DROP POLICY IF EXISTS "Users can delete own comments" ON public.item_comments;
CREATE POLICY "Users can delete own comments" ON public.item_comments
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT ON public.item_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.item_comments TO authenticated;

COMMIT;
