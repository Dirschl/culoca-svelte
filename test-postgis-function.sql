-- Test PostGIS function existence and functionality
-- Run this in Supabase SQL Editor

-- 1. Check if function exists
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'gallery_items_unified_postgis';

-- 2. Test function with basic parameters
SELECT * FROM gallery_items_unified_postgis(
  user_lat := 0,
  user_lon := 0,
  page_value := 0,
  page_size_value := 10,
  current_user_id := NULL,
  search_term := NULL,
  location_filter_lat := NULL,
  location_filter_lon := NULL,
  filter_user_id := NULL
) LIMIT 5;

-- 3. Check if there are any gallery items at all
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN gallery = true THEN 1 END) as gallery_items,
  COUNT(CASE WHEN path_512 IS NOT NULL THEN 1 END) as items_with_512,
  COUNT(CASE WHEN is_private = false OR is_private IS NULL THEN 1 END) as public_items
FROM items;

-- 4. Check sample items that should be visible
SELECT 
  id,
  slug,
  title,
  gallery,
  is_private,
  path_512,
  lat,
  lon
FROM items 
WHERE path_512 IS NOT NULL
  AND gallery = true
  AND (is_private = false OR is_private IS NULL)
ORDER BY created_at DESC
LIMIT 10; 