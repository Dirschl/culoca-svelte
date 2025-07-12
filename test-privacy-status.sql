-- Test Privacy Status: Check if is_private field is properly populated
-- Run this in Supabase SQL Editor

-- Check current status of is_private field
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN is_private = TRUE THEN 1 END) as private_items,
    COUNT(CASE WHEN is_private = FALSE THEN 1 END) as public_items,
    COUNT(CASE WHEN is_private IS NULL THEN 1 END) as null_items
FROM items;

-- Show some sample records to verify data
SELECT 
    i.id,
    i.title,
    i.profile_id,
    i.is_private,
    p.privacy_mode,
    i.created_at
FROM items i
LEFT JOIN profiles p ON i.profile_id = p.id
ORDER BY i.created_at DESC 
LIMIT 10;

-- Check if there are any inconsistencies between is_private and profile privacy_mode
SELECT 
    COUNT(*) as inconsistent_items,
    'Items with is_private=false but profile privacy_mode=private' as issue_type
FROM items i
JOIN profiles p ON i.profile_id = p.id
WHERE i.is_private = FALSE AND p.privacy_mode = 'private'

UNION ALL

SELECT 
    COUNT(*) as inconsistent_items,
    'Items with is_private=true but profile privacy_mode=public' as issue_type
FROM items i
JOIN profiles p ON i.profile_id = p.id
WHERE i.is_private = TRUE AND p.privacy_mode = 'public'; 