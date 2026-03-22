BEGIN;

CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_distinct_users CHECK (follower_user_id <> followed_user_id),
  CONSTRAINT user_follows_unique_pair UNIQUE (follower_user_id, followed_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_created_at
  ON public.user_follows(follower_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follows_followed_created_at
  ON public.user_follows(followed_user_id, created_at DESC);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view own follows" ON public.user_follows;
CREATE POLICY "Authenticated users can view own follows" ON public.user_follows
  FOR SELECT USING (auth.uid() = follower_user_id OR auth.uid() = followed_user_id);

DROP POLICY IF EXISTS "Authenticated users can create own follows" ON public.user_follows;
CREATE POLICY "Authenticated users can create own follows" ON public.user_follows
  FOR INSERT WITH CHECK (
    auth.uid() = follower_user_id
    AND follower_user_id <> followed_user_id
  );

DROP POLICY IF EXISTS "Authenticated users can delete own follows" ON public.user_follows;
CREATE POLICY "Authenticated users can delete own follows" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_user_id);

GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;

COMMIT;
