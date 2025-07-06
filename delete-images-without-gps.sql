-- Delete all images without GPS coordinates (lat IS NULL or lon IS NULL)

-- First, let's see how many images will be deleted
SELECT 
    COUNT(*) as images_without_gps,
    COUNT(CASE WHEN lat IS NULL THEN 1 END) as lat_null_count,
    COUNT(CASE WHEN lon IS NULL THEN 1 END) as lon_null_count,
    COUNT(CASE WHEN lat IS NULL AND lon IS NULL THEN 1 END) as both_null_count
FROM images 
WHERE lat IS NULL OR lon IS NULL;

-- Show some examples of images that will be deleted
SELECT 
    id,
    original_name,
    title,
    description,
    lat,
    lon,
    created_at
FROM images 
WHERE lat IS NULL OR lon IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Now delete all images without GPS coordinates
DELETE FROM images 
WHERE lat IS NULL OR lon IS NULL;

-- Verify the deletion
SELECT 
    COUNT(*) as total_images_after_deletion,
    COUNT(CASE WHEN lat IS NOT NULL AND lon IS NOT NULL THEN 1 END) as images_with_gps,
    COUNT(CASE WHEN lat IS NULL OR lon IS NULL THEN 1 END) as images_without_gps
FROM images;

-- Show final statistics
SELECT 
    'Total images remaining' as status,
    COUNT(*) as count
FROM images
UNION ALL
SELECT 
    'Images with GPS' as status,
    COUNT(*) as count
FROM images
WHERE lat IS NOT NULL AND lon IS NOT NULL
UNION ALL
SELECT 
    'Images without GPS' as status,
    COUNT(*) as count
FROM images
WHERE lat IS NULL OR lon IS NULL; 