-- Check database structure and content
-- This script provides an overview of the items table

-- Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'items'
ORDER BY ordinal_position;

-- Check total count of items
SELECT COUNT(*) as total_items FROM items;

-- Check items with GPS coordinates
SELECT 
    COUNT(*) as items_with_gps,
    COUNT(CASE WHEN lat IS NOT NULL AND lon IS NOT NULL THEN 1 END) as items_with_both_coords,
    COUNT(CASE WHEN lat IS NULL OR lon IS NULL THEN 1 END) as items_without_gps
FROM items;

-- Check items with different image sizes
SELECT 
    COUNT(*) as total_items,
    COUNT(path_512) as items_with_512px,
    COUNT(path_2048) as items_with_2048px,
    COUNT(path_64) as items_with_64px
FROM items;

-- Check recent items
SELECT 
    id,
    original_name,
    created_at,
    lat,
    lon
FROM items
ORDER BY created_at DESC
LIMIT 10; 