-- Debug items_by_distance function
-- Run this in Supabase SQL Console

-- Check if function exists
SELECT 
    'Function Check' as test_type,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'items_by_distance_manual';

-- Check if function exists (alternative)
SELECT 
    'Function Check Alternative' as test_type,
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'items_by_distance_manual';

-- Test the function if it exists
SELECT 
    'items_by_distance_manual test' as test_name,
    COUNT(*) as total_items,
    MIN(distance) as min_distance,
    MAX(distance) as max_distance,
    AVG(distance) as avg_distance
FROM items_by_distance_manual(48.31783, 12.71324, 0, 10, NULL, TRUE, NULL);

-- Show first 5 items with distances
SELECT 
    id,
    title,
    lat,
    lon,
    ROUND(distance) as distance_meters,
    created_at
FROM items_by_distance_manual(48.31783, 12.71324, 0, 5, NULL, TRUE, NULL);

-- Test pagination
SELECT 
    'Page 0' as page_info,
    COUNT(*) as items_count,
    MIN(distance) as min_distance,
    MAX(distance) as max_distance
FROM items_by_distance_manual(48.31783, 12.71324, 0, 10, NULL, TRUE, NULL);

SELECT 
    'Page 1' as page_info,
    COUNT(*) as items_count,
    MIN(distance) as min_distance,
    MAX(distance) as max_distance
FROM items_by_distance_manual(48.31783, 12.71324, 1, 10, NULL, TRUE, NULL);

-- Compare with manual query
SELECT 
    'Manual Query Comparison' as test_type,
    COUNT(*) as total_items,
    MIN(distance) as min_distance,
    MAX(distance) as max_distance
FROM (
    SELECT 
        id,
        title,
        lat,
        lon,
        6371000 * acos(
            cos(radians(48.31783)) * cos(radians(lat)) * 
            cos(radians(lon) - radians(12.71324)) + 
            sin(radians(48.31783)) * sin(radians(lat))
        ) as distance
    FROM items 
    WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL
    AND (gallery = true OR gallery IS NULL)
    AND (is_private = false OR is_private IS NULL)
) manual_calc; 