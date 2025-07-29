-- Debug script to check GPS data and item_views table

-- Check item_views table structure
\d item_views;

-- Check if we have any item_views with distance data
SELECT 
    COUNT(*) as total_views,
    COUNT(*) FILTER (WHERE distance_meters IS NOT NULL) as views_with_distance,
    COUNT(*) FILTER (WHERE distance_meters IS NULL) as views_without_distance,
    COUNT(*) FILTER (WHERE visitor_lat IS NOT NULL) as views_with_visitor_lat,
    COUNT(*) FILTER (WHERE visitor_lon IS NOT NULL) as views_with_visitor_lon
FROM item_views;

-- Show recent item_views with all data
SELECT 
    id,
    item_id,
    visitor_id,
    distance_meters,
    visitor_lat,
    visitor_lon,
    created_at
FROM item_views 
ORDER BY created_at DESC 
LIMIT 10;

-- Check items with GPS coordinates
SELECT 
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL) as items_with_gps,
    COUNT(*) FILTER (WHERE lat IS NULL OR lon IS NULL) as items_without_gps
FROM items;

-- Show sample items with GPS
SELECT 
    id,
    title,
    lat,
    lon
FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL 
LIMIT 5; 