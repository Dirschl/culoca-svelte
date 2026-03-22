BEGIN;

ALTER TABLE public.item_comments
  DROP CONSTRAINT IF EXISTS item_comments_status_check;

ALTER TABLE public.item_comments
  ADD CONSTRAINT item_comments_status_check
  CHECK (status IN ('visible', 'hidden', 'deleted'));

DROP POLICY IF EXISTS "Anyone can view visible comments" ON public.item_comments;
CREATE POLICY "Anyone can view visible comments" ON public.item_comments
  FOR SELECT USING (
    status = 'visible'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = item_comments.item_id
        AND items.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Item owners can moderate comments" ON public.item_comments;
CREATE POLICY "Item owners can moderate comments" ON public.item_comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = item_comments.item_id
        AND items.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = item_comments.item_id
        AND items.profile_id = auth.uid()
    )
  );

COMMIT;
