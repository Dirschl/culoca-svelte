-- Enable anonymous access to public items
-- This script updates RLS policies to allow anonymous users to view public items

-- Drop existing policies that restrict anonymous access
DROP POLICY IF EXISTS "Public can view non-private items" ON items;
DROP POLICY IF EXISTS "Users can view their own items" ON items;

-- Create new policy that allows anonymous access to public items
CREATE POLICY "Anyone can view public items" ON items
    FOR SELECT USING (
        is_private = false OR is_private IS NULL
    );

-- Create policy for authenticated users to view their own items (including private ones)
CREATE POLICY "Authenticated users can view their own items" ON items
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Keep existing policies for insert, update, delete (only for authenticated users)
-- These policies remain unchanged as they already require authentication

-- Add index for better performance on is_private queries
CREATE INDEX IF NOT EXISTS idx_items_is_private_public ON items(is_private) WHERE is_private = false OR is_private IS NULL;

-- Add comment explaining the new access pattern
COMMENT ON POLICY "Anyone can view public items" ON items IS 'Allows anonymous and authenticated users to view public items';
COMMENT ON POLICY "Authenticated users can view their own items" ON items IS 'Allows authenticated users to view their own items (including private ones)'; 