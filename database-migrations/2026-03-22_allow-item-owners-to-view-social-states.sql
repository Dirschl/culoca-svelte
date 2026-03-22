BEGIN;

DROP POLICY IF EXISTS "Item owners can view favorites for own items" ON public.item_favorites;
CREATE POLICY "Item owners can view favorites for own items" ON public.item_favorites
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = item_favorites.item_id
        AND items.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Item owners can view likes for own items" ON public.item_likes;
CREATE POLICY "Item owners can view likes for own items" ON public.item_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = item_likes.item_id
        AND items.profile_id = auth.uid()
    )
  );

COMMIT;
