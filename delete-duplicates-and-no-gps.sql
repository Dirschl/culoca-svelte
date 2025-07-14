-- Delete duplicates and items without GPS coordinates
-- This script removes duplicate items and items without GPS data

-- Step 1: Count total items
SELECT COUNT(*) as total_items
FROM items;

-- Step 2: Find duplicate items (same lat/lon and title)
SELECT 
    lat,
    lon,
    title,
    COUNT(*) as duplicate_count
FROM items
WHERE lat IS NOT NULL 
    AND lon IS NOT NULL 
    AND title IS NOT NULL
GROUP BY lat, lon, title
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 3: Show items without GPS coordinates
SELECT 
    COUNT(*) as items_without_gps
FROM items
WHERE lat IS NULL OR lon IS NULL;

-- Step 4: Delete items without GPS coordinates
-- WARNING: This will permanently delete items!
-- Uncomment the following line to actually delete:
-- DELETE FROM items WHERE lat IS NULL OR lon IS NULL;

-- Step 5: Delete duplicate items (keep the oldest one)
-- WARNING: This will permanently delete items!
-- Uncomment the following lines to actually delete:
/*
DELETE FROM items 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY lat, lon, title 
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

-- Step 6: Verify cleanup
SELECT 
    COUNT(*) as total_items_after_cleanup,
    COUNT(CASE WHEN lat IS NOT NULL AND lon IS NOT NULL THEN 1 END) as items_with_gps,
    COUNT(CASE WHEN lat IS NULL OR lon IS NULL THEN 1 END) as items_without_gps
FROM items; 