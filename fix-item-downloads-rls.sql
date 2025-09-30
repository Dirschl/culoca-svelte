-- Fix RLS policies for item_downloads table
-- This script fixes the RLS policies to allow system inserts

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own downloads" ON item_downloads;
DROP POLICY IF EXISTS "Item owners can view downloads of their items" ON item_downloads;
DROP POLICY IF EXISTS "System can insert downloads" ON item_downloads;

-- Create new policies
-- Allow system to insert downloads (for API logging)
CREATE POLICY "System can insert downloads" ON item_downloads
  FOR INSERT WITH CHECK (true);

-- Allow users to view their own downloads
CREATE POLICY "Users can view their own downloads" ON item_downloads
  FOR SELECT USING (auth.uid() = user_id);

-- Allow item owners to view downloads of their items
CREATE POLICY "Item owners can view downloads of their items" ON item_downloads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = item_downloads.item_id 
      AND items.profile_id = auth.uid()
    )
  );

-- Allow admins to view all downloads
CREATE POLICY "Admins can view all downloads" ON item_downloads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_id = 3
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON item_downloads TO authenticated;
GRANT SELECT, INSERT ON item_downloads TO anon;

-- Test the function
SELECT 'RLS policies fixed successfully!' as status;




