-- Delete duplicate items based on GPS coordinates, title, and description
-- This script removes duplicate items that have the same location and content

-- Step 1: Find duplicate items (same lat/lon, title, and description)
SELECT 
    lat,
    lon,
    title,
    description,
    COUNT(*) as duplicate_count
FROM items
WHERE lat IS NOT NULL 
    AND lon IS NOT NULL 
    AND title IS NOT NULL
GROUP BY lat, lon, title, description
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Delete duplicate items (keep the oldest one)
-- WARNING: This will permanently delete items!
-- Uncomment the following lines to actually delete:
/*
DELETE FROM items 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY lat, lon, title, description 
                   ORDER BY created_at ASC
               ) as rn
        FROM items
        WHERE lat IS NOT NULL 
            AND lon IS NOT NULL 
            AND title IS NOT NULL
    ) t
    WHERE t.rn > 1
);
*/

-- Step 3: Show remaining items after deletion
SELECT COUNT(*) as total_items_after_deletion FROM items; 