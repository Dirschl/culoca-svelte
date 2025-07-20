-- Debug script to check gallery data availability
-- Run this in Supabase SQL editor to see what's happening

-- Check total number of items
SELECT COUNT(*) as total_items FROM items;

-- Check items with GPS coordinates
SELECT COUNT(*) as items_with_gps FROM items WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Check items with path_512
SELECT COUNT(*) as items_with_path_512 FROM items WHERE path_512 IS NOT NULL;

-- Check items with gallery = true
SELECT COUNT(*) as items_with_gallery_true FROM items WHERE gallery = true;

-- Check items with gallery = false
SELECT COUNT(*) as items_with_gallery_false FROM items WHERE gallery = false;

-- Check items with gallery IS NULL
SELECT COUNT(*) as items_with_gallery_null FROM items WHERE gallery IS NULL;

-- Check public items (is_private = false or NULL)
SELECT COUNT(*) as public_items FROM items WHERE is_private = false OR is_private IS NULL;

-- Check private items
SELECT COUNT(*) as private_items FROM items WHERE is_private = true;

-- Check items that would be returned by our function (with gallery filter, public only)
SELECT COUNT(*) as items_available_for_gallery FROM items 
WHERE lat IS NOT NULL 
AND lon IS NOT NULL 
AND path_512 IS NOT NULL
AND gallery = true
AND (is_private = false OR is_private IS NULL);

-- Check items that would be returned by our function (without gallery filter, public only)
SELECT COUNT(*) as items_available_without_gallery_filter FROM items 
WHERE lat IS NOT NULL 
AND lon IS NOT NULL 
AND path_512 IS NOT NULL
AND (is_private = false OR is_private IS NULL);

-- Sample some items to see their gallery values
SELECT id, lat, lon, path_512, gallery, is_private, created_at 
FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL
ORDER BY created_at DESC 
LIMIT 10;

-- Test the items_by_distance function with minimal parameters first
SELECT COUNT(*) as result_count FROM items_by_distance(52.5200::DOUBLE PRECISION, 13.4050::DOUBLE PRECISION);

-- Test with explicit default values (require_gallery = FALSE)
SELECT COUNT(*) as result_count_without_gallery_filter FROM items_by_distance(52.5200::DOUBLE PRECISION, 13.4050::DOUBLE PRECISION, 0, 50, NULL::UUID, FALSE, NULL::UUID);

-- Test with gallery filter enabled (require_gallery = TRUE)
SELECT COUNT(*) as result_count_with_gallery_filter FROM items_by_distance(52.5200::DOUBLE PRECISION, 13.4050::DOUBLE PRECISION, 0, 50, NULL::UUID, TRUE, NULL::UUID);

-- Test the alias function
SELECT COUNT(*) as alias_result_count FROM images_by_distance(52.5200::DOUBLE PRECISION, 13.4050::DOUBLE PRECISION, 0, 50, NULL::UUID); 