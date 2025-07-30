-- Check storage structure and paths
-- This script helps understand how images are stored

-- 1. Check all image paths
SELECT 
    id,
    original_name,
    path_512,
    path_64,
    path_2048,
    created_at
FROM items 
LIMIT 10;

-- 2. Check for images with missing paths
SELECT 
    COUNT(*) as total_images,
    COUNT(path_512) as images_with_512px,
    COUNT(path_64) as images_with_64px,
    COUNT(path_2048) as images_with_2048px,
    COUNT(CASE WHEN path_512 IS NULL THEN 1 END) as missing_512px,
    COUNT(CASE WHEN path_64 IS NULL THEN 1 END) as missing_64px,
    COUNT(CASE WHEN path_2048 IS NULL THEN 1 END) as missing_2048px
FROM items;

-- 3. Check for images with EXIF orientation data
SELECT 
    COUNT(*) as total_images,
    COUNT(CASE WHEN exif_json IS NOT NULL THEN 1 END) as images_with_exif,
    COUNT(CASE WHEN exif_json::text LIKE '%Orientation%' THEN 1 END) as images_with_orientation,
    COUNT(CASE WHEN exif_json::text LIKE '%"Orientation":1%' THEN 1 END) as normal_orientation,
    COUNT(CASE WHEN exif_json::text LIKE '%Orientation%' AND exif_json::text NOT LIKE '%"Orientation":1%' THEN 1 END) as needs_fix
FROM items;

-- 4. Sample images with orientation issues
SELECT 
    id,
    original_name,
    path_512,
    exif_json::text as exif_text
FROM items 
WHERE exif_json::text LIKE '%Orientation%' 
    AND exif_json::text NOT LIKE '%"Orientation":1%'
LIMIT 5; 