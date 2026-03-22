BEGIN;

CREATE TABLE IF NOT EXISTS public.item_likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_likes_item_created_at
  ON public.item_likes(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_likes_user_created_at
  ON public.item_likes(user_id, created_at DESC);

ALTER TABLE public.item_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own likes" ON public.item_likes;
CREATE POLICY "Users can view own likes" ON public.item_likes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own likes" ON public.item_likes;
CREATE POLICY "Users can insert own likes" ON public.item_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON public.item_likes;
CREATE POLICY "Users can delete own likes" ON public.item_likes
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.item_likes TO authenticated;

COMMIT;
