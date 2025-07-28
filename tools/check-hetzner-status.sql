-- Check Hetzner Storage Status
-- This script shows how many images are stored where

-- 1. Check if original_url field exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'items' 
  AND column_name = 'original_url';

-- 2. Count images by storage location
SELECT 
  'Total Images' as category,
  COUNT(*) as count
FROM items 
WHERE path_512 IS NOT NULL

UNION ALL

SELECT 
  'Images with Hetzner Original' as category,
  COUNT(*) as count
FROM items 
WHERE original_url IS NOT NULL

UNION ALL

SELECT 
  'Images without Hetzner Original' as category,
  COUNT(*) as count
FROM items 
WHERE original_url IS NULL AND path_512 IS NOT NULL;

-- 3. Show sample of images without Hetzner originals
SELECT 
  id,
  title,
  created_at,
  original_url
FROM items 
WHERE original_url IS NULL 
  AND path_512 IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 4. Show sample of images with Hetzner originals (if any)
SELECT 
  id,
  title,
  original_url,
  created_at
FROM items 
WHERE original_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10; 