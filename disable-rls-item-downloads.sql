-- Disable RLS for item_downloads table temporarily for testing
-- This script disables RLS to allow inserts and selects

-- Disable RLS on item_downloads table
ALTER TABLE item_downloads DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to authenticated and anon users
GRANT ALL ON item_downloads TO authenticated;
GRANT ALL ON item_downloads TO anon;

-- Test the function
SELECT 'RLS disabled for item_downloads table!' as status;




