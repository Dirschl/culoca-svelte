-- Check database structure without making any changes
-- This script only queries the current state

-- Check if images table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'images'
) as table_exists;

-- If table exists, show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'images'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'images';

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'images';

-- Count existing records
SELECT COUNT(*) as total_images FROM images;

-- Show sample records (if any exist)
SELECT 
    id,
    profile_id,
    user_id,
    path_512,
    created_at
FROM images 
LIMIT 5;

-- Check if the images_by_distance function exists
SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'images_by_distance'
) as function_exists; 