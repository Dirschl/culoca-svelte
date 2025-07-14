-- Recreate 64px thumbnails for all items
-- This script will regenerate all 64px thumbnails from the 512px versions

-- Step 1: Delete all files from images-64 bucket
-- (This needs to be done manually in the Supabase dashboard)

-- Step 2: Get all items that have 512px thumbnails but no 64px thumbnails
SELECT 
    id,
    path_512,
    path_64
FROM items
WHERE path_512 IS NOT NULL 
    AND (path_64 IS NULL OR path_64 = '');

-- Step 3: Get count of items that need 64px thumbnails
SELECT COUNT(*) as items_needing_64px
FROM items
WHERE path_512 IS NOT NULL 
    AND (path_64 IS NULL OR path_64 = ''); 