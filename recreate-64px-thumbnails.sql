-- Delete existing 64px thumbnails and reset path_64 field
-- This will force recreation of all 64px thumbnails with higher quality

-- Step 1: Delete all files from images-64 bucket
-- Note: This requires manual execution in Supabase Storage interface
-- Go to Storage > images-64 bucket and delete all files

-- Step 2: Reset path_64 field for all images
UPDATE images 
SET path_64 = NULL 
WHERE path_64 IS NOT NULL;

-- Step 3: Verify the reset
SELECT 
  COUNT(*) as total_images,
  COUNT(path_64) as images_with_64px,
  COUNT(*) - COUNT(path_64) as images_without_64px
FROM images;

-- Step 4: Show images that will need 64px recreation
SELECT 
  id,
  original_name,
  path_512,
  path_64
FROM images 
WHERE path_64 IS NULL
ORDER BY created_at DESC
LIMIT 10; 