-- Delete duplicates based on GPS coordinates, title, and description
-- Keep the oldest image (smallest ID) and delete newer duplicates

-- First, let's see what duplicates exist
SELECT 
    lat, 
    lon, 
    title, 
    description,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY id) as image_ids
FROM images 
WHERE lat IS NOT NULL 
    AND lon IS NOT NULL 
    AND title IS NOT NULL 
    AND description IS NOT NULL
GROUP BY lat, lon, title, description
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, lat, lon;

-- Now delete the duplicates, keeping the oldest one (smallest ID)
DELETE FROM images 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY lat, lon, title, description 
                   ORDER BY id
               ) as rn
        FROM images 
        WHERE lat IS NOT NULL 
            AND lon IS NOT NULL 
            AND title IS NOT NULL 
            AND description IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Verify the deletion by checking for remaining duplicates
SELECT 
    lat, 
    lon, 
    title, 
    description,
    COUNT(*) as remaining_count
FROM images 
WHERE lat IS NOT NULL 
    AND lon IS NOT NULL 
    AND title IS NOT NULL 
    AND description IS NOT NULL
GROUP BY lat, lon, title, description
HAVING COUNT(*) > 1
ORDER BY remaining_count DESC, lat, lon;

-- Show final count
SELECT COUNT(*) as total_images_after_deletion FROM images; 