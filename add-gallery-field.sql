-- Add gallery field to items table
-- This field controls which images are shown in the main gallery

ALTER TABLE items ADD COLUMN gallery BOOLEAN DEFAULT true;

-- Update existing items to have gallery = true by default
UPDATE items SET gallery = true WHERE gallery IS NULL;

-- Create index for better performance
CREATE INDEX idx_items_gallery ON items(gallery);

-- Update RLS policies to include gallery field
-- For authenticated users: show their own images (all) + other users' public gallery images
DROP POLICY IF EXISTS "Users can view items" ON items;
CREATE POLICY "Users can view items" ON items
  FOR SELECT USING (
    auth.uid() = profile_id OR 
    (is_private = false OR is_private IS NULL) AND gallery = true
  );

-- For anonymous users: only show public gallery images
DROP POLICY IF EXISTS "Anonymous users can view public items" ON items;
CREATE POLICY "Anonymous users can view public items" ON items
  FOR SELECT USING (
    (is_private = false OR is_private IS NULL) AND gallery = true
  );

-- Grant permissions for items_search_view
GRANT SELECT ON items_search_view TO authenticated;
GRANT SELECT ON items_search_view TO anon; 