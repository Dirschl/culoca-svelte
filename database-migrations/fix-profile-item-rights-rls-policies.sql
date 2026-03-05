-- Fix RLS policies for profile_rights and item_rights
-- Safe to run multiple times

-- Ensure RLS is enabled
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;

-- Cleanup legacy/incorrect policies
DROP POLICY IF EXISTS "Users can read their own profile rights" ON profile_rights;
DROP POLICY IF EXISTS "Users can manage their own profile rights" ON profile_rights;
DROP POLICY IF EXISTS "Users can read rights granted to them" ON profile_rights;

DROP POLICY IF EXISTS "Users can read their own item rights" ON item_rights;
DROP POLICY IF EXISTS "Users can manage their own item rights" ON item_rights;
DROP POLICY IF EXISTS "Item owners can manage rights for their items" ON item_rights;
DROP POLICY IF EXISTS "Users can read item rights granted to them" ON item_rights;

-- profile_rights: owner can fully manage, target user can read their grants
CREATE POLICY "profile_rights_select_owner_or_target" ON profile_rights
  FOR SELECT
  USING (profile_id = auth.uid() OR target_user_id = auth.uid());

CREATE POLICY "profile_rights_insert_owner" ON profile_rights
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_rights_update_owner" ON profile_rights
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_rights_delete_owner" ON profile_rights
  FOR DELETE
  USING (profile_id = auth.uid());

-- item_rights: item owner can fully manage, target user can read their grants
CREATE POLICY "item_rights_select_owner_or_target" ON item_rights
  FOR SELECT
  USING (
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM items i
      WHERE i.id = item_rights.item_id
        AND i.profile_id = auth.uid()
    )
  );

CREATE POLICY "item_rights_insert_item_owner" ON item_rights
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM items i
      WHERE i.id = item_rights.item_id
        AND i.profile_id = auth.uid()
    )
  );

CREATE POLICY "item_rights_update_item_owner" ON item_rights
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM items i
      WHERE i.id = item_rights.item_id
        AND i.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM items i
      WHERE i.id = item_rights.item_id
        AND i.profile_id = auth.uid()
    )
  );

CREATE POLICY "item_rights_delete_item_owner" ON item_rights
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM items i
      WHERE i.id = item_rights.item_id
        AND i.profile_id = auth.uid()
    )
  );
