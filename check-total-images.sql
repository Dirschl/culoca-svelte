-- Check total images in database
-- Run this in Supabase SQL Editor to see how many images you have

-- 1. Total count of all images
SELECT 'Total images in database:' as info, COUNT(*) as count FROM items;

-- 2. Images with GPS coordinates
SELECT 'Images with GPS coordinates:' as info, COUNT(*) as count 
FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- 3. Images with 64px thumbnails
SELECT 'Images with 64px thumbnails:' as info, COUNT(*) as count 
FROM items 
WHERE path_64 IS NOT NULL;

-- 4. Images with 512px images
SELECT 'Images with 512px images:' as info, COUNT(*) as count 
FROM items 
WHERE path_512 IS NOT NULL;

-- 5. Public images (not private)
SELECT 'Public images:' as info, COUNT(*) as count 
FROM items 
WHERE is_private = false OR is_private IS NULL;

-- 6. Gallery images
SELECT 'Gallery images:' as info, COUNT(*) as count 
FROM items 
WHERE gallery = true;

-- 7. Images that meet all criteria for map display
SELECT 'Images ready for map display:' as info, COUNT(*) as count 
FROM items 
WHERE path_512 IS NOT NULL
  AND gallery = true
  AND lat IS NOT NULL
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
  AND (is_private = false OR is_private IS NULL);

-- 8. Sample of images that would be shown on map
SELECT 'Sample of map-ready images:' as info;
SELECT 
  id,
  slug,
  title,
  lat,
  lon,
  path_64,
  is_private,
  gallery
FROM items 
WHERE path_512 IS NOT NULL
  AND gallery = true
  AND lat IS NOT NULL
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
  AND (is_private = false OR is_private IS NULL)
ORDER BY created_at DESC
LIMIT 10; 