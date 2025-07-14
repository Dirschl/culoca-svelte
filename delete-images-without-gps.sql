-- Delete items without GPS coordinates
-- This script removes items that don't have latitude/longitude data

-- Step 1: Count items without GPS coordinates
SELECT 
    COUNT(*) as total_items,
    COUNT(lat) as items_with_lat,
    COUNT(lon) as items_with_lon,
    COUNT(*) - COUNT(lat) as items_without_lat,
    COUNT(*) - COUNT(lon) as items_without_lon
FROM items;

-- Step 2: Show items without GPS coordinates (first 10)
SELECT 
    id,
    original_name,
    created_at,
    lat,
    lon
FROM items
WHERE lat IS NULL OR lon IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Delete items without GPS coordinates
-- WARNING: This will permanently delete items!
-- Uncomment the following line to actually delete:
-- DELETE FROM items WHERE lat IS NULL OR lon IS NULL;

-- Step 4: Verify deletion
SELECT 
    COUNT(*) as total_items_after_deletion,
    COUNT(lat) as items_with_lat_after,
    COUNT(lon) as items_with_lon_after
FROM items;

-- Step 5: Show remaining items without GPS (should be 0)
SELECT 
    COUNT(*) as remaining_items_without_gps
FROM items
WHERE lat IS NULL OR lon IS NULL; 