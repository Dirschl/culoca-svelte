-- SQL Script to delete duplicates and entries without GPS data
-- WARNING: This will permanently delete data. Make sure to backup first!

-- 1. First, let's see what we're dealing with
SELECT 
    COUNT(*) as total_images,
    COUNT(CASE WHEN lat IS NULL OR lon IS NULL THEN 1 END) as images_without_gps,
    COUNT(CASE WHEN lat IS NOT NULL AND lon IS NOT NULL THEN 1 END) as images_with_gps
FROM images;

-- 2. Show duplicates based on path_512 (same image file)
SELECT 
    path_512,
    COUNT(*) as duplicate_count,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY id) as all_ids
FROM images 
WHERE path_512 IS NOT NULL
GROUP BY path_512 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Show duplicates based on GPS coordinates (same location)
SELECT 
    lat,
    lon,
    COUNT(*) as duplicate_count,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY id) as all_ids
FROM images 
WHERE lat IS NOT NULL AND lon IS NOT NULL
GROUP BY lat, lon
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. DELETE entries without GPS data
-- Uncomment the following line to actually delete:
-- DELETE FROM images WHERE lat IS NULL OR lon IS NULL;

-- 5. DELETE duplicates based on path_512 (keep the oldest entry)
-- Uncomment the following lines to actually delete:
/*
DELETE FROM images 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY path_512 ORDER BY created_at ASC) as rn
        FROM images 
        WHERE path_512 IS NOT NULL
    ) t 
    WHERE t.rn > 1
);
*/

-- 6. DELETE duplicates based on GPS coordinates (keep the oldest entry)
-- Uncomment the following lines to actually delete:
/*
DELETE FROM images 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY lat, lon ORDER BY created_at ASC) as rn
        FROM images 
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    ) t 
    WHERE t.rn > 1
);
*/

-- 7. Final count after cleanup
-- Run this after the deletions to see the results:
/*
SELECT 
    COUNT(*) as total_images_after_cleanup,
    COUNT(CASE WHEN lat IS NULL OR lon IS NULL THEN 1 END) as images_without_gps_after,
    COUNT(CASE WHEN lat IS NOT NULL AND lon IS NOT NULL THEN 1 END) as images_with_gps_after
FROM images;
*/ 