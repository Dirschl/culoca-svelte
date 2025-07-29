-- Test script to verify distance calculation
-- This script tests the log_item_view function with sample data

-- First, let's check if we have any items with GPS coordinates
SELECT id, title, lat, lon 
FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL 
LIMIT 5;

-- Test the log_item_view function with sample coordinates
-- Munich coordinates (48.1351, 11.5820) to test with
SELECT log_item_view(
    '00000000-0000-0000-0000-000000000001'::uuid, -- Replace with actual item ID
    '00000000-0000-0000-0000-000000000002'::uuid, -- Test visitor ID
    'https://example.com/test',
    'Test User Agent',
    '127.0.0.1'::inet,
    48.1351, -- Munich latitude
    11.5820  -- Munich longitude
);

-- Check if the view was logged
SELECT 
    item_id,
    visitor_id,
    distance_meters,
    visitor_lat,
    visitor_lon,
    created_at
FROM item_views 
WHERE visitor_id = '00000000-0000-0000-0000-000000000002'
ORDER BY created_at DESC
LIMIT 5;

-- Test with anonymous visitor (no GPS)
SELECT log_item_view(
    '00000000-0000-0000-0000-000000000001'::uuid, -- Replace with actual item ID
    NULL, -- Anonymous visitor
    'https://example.com/test-anonymous',
    'Test User Agent Anonymous',
    '127.0.0.1'::inet,
    NULL, -- No GPS
    NULL   -- No GPS
);

-- Check anonymous view
SELECT 
    item_id,
    visitor_id,
    distance_meters,
    visitor_lat,
    visitor_lon,
    created_at
FROM item_views 
WHERE visitor_id IS NULL
ORDER BY created_at DESC
LIMIT 5; 