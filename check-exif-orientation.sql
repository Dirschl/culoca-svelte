-- Check for images with EXIF orientation issues
-- This script helps identify images that might have orientation problems

-- 1. Get all images with their metadata
SELECT 
    id,
    original_name,
    path_512,
    path_64,
    exif_json,
    created_at
FROM items 
WHERE exif_json IS NOT NULL
ORDER BY created_at DESC;

-- 2. Check for images with specific orientation values
-- Orientation values:
-- 1 = Normal (no rotation needed)
-- 2 = Mirror horizontal
-- 3 = Rotate 180°
-- 4 = Mirror vertical
-- 5 = Mirror horizontal and rotate 270° CW
-- 6 = Rotate 90° CW
-- 7 = Mirror horizontal and rotate 90° CW
-- 8 = Rotate 270° CW

-- 3. Find images that might need orientation fix
-- (This is a manual check since EXIF data is stored as JSON)
-- Look for images where exif_json contains "Orientation" with values other than 1

-- 4. Get count of images with thumbnails
SELECT 
    COUNT(*) as total_images,
    COUNT(path_512) as images_with_512px,
    COUNT(path_64) as images_with_64px,
    COUNT(CASE WHEN path_512 IS NOT NULL AND path_64 IS NOT NULL THEN 1 END) as images_with_both_thumbnails
FROM items;

-- 5. Find images that might have orientation issues
-- (This is a heuristic based on common patterns)
SELECT 
    id,
    original_name,
    path_512,
    path_64,
    created_at
FROM items 
WHERE exif_json IS NOT NULL
    AND exif_json::text LIKE '%Orientation%'
    AND exif_json::text NOT LIKE '%"Orientation":1%'
ORDER BY created_at DESC; 