-- Fix RLS limit for map by creating unlimited policy for public items
-- This allows the PostGIS function to return all public images without 1000 limit

-- 1. Drop existing policies that might have limits
DROP POLICY IF EXISTS "Allow anonymous users to view public items" ON items;
DROP POLICY IF EXISTS "Allow authenticated users to view public items" ON items;
DROP POLICY IF EXISTS "Allow users to view their own items" ON items;

-- 2. Create new unlimited policies
-- Policy for anonymous users - view all public items
CREATE POLICY "Allow anonymous users to view public items unlimited" ON items
FOR SELECT
TO anon
USING (
  gallery = true 
  AND (is_private = false OR is_private IS NULL)
  AND lat IS NOT NULL 
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
);

-- Policy for authenticated users - view public items + their own items
CREATE POLICY "Allow authenticated users to view items unlimited" ON items
FOR SELECT
TO authenticated
USING (
  gallery = true 
  AND (
    is_private = false 
    OR is_private IS NULL 
    OR profile_id = auth.uid()
  )
  AND lat IS NOT NULL 
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
);

-- 3. Test the policies
-- This should return all public items without 1000 limit
SELECT COUNT(*) as total_public_items 
FROM items 
WHERE gallery = true 
  AND (is_private = false OR is_private IS NULL)
  AND lat IS NOT NULL 
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL; 