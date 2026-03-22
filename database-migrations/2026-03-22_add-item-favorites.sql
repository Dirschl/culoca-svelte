BEGIN;

CREATE TABLE IF NOT EXISTS public.item_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_favorites_item_created_at
  ON public.item_favorites(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_favorites_user_created_at
  ON public.item_favorites(user_id, created_at DESC);

ALTER TABLE public.item_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.item_favorites;
CREATE POLICY "Users can view own favorites" ON public.item_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.item_favorites;
CREATE POLICY "Users can insert own favorites" ON public.item_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.item_favorites;
CREATE POLICY "Users can delete own favorites" ON public.item_favorites
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.item_favorites TO authenticated;

COMMIT;
