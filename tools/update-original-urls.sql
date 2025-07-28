-- Update original_url fields for existing images
-- This script sets the original_url for all images that don't have it yet

-- First, let's see the current status
SELECT 
  'Images with original_url' as category,
  COUNT(*) as count
FROM items 
WHERE original_url IS NOT NULL

UNION ALL

SELECT 
  'Images without original_url' as category,
  COUNT(*) as count
FROM items 
WHERE original_url IS NULL AND path_512 IS NOT NULL;

-- Update original_url for all images that don't have it
-- Using the standard Hetzner path format: items/{id}.jpg
UPDATE items 
SET original_url = CONCAT(
  COALESCE(
    current_setting('app.hetzner_public_url', true),
    'https://your-hetzner-public-url.com'
  ),
  '/items/',
  id,
  '.jpg'
)
WHERE original_url IS NULL 
  AND path_512 IS NOT NULL;

-- Show the results
SELECT 
  'Updated images' as category,
  COUNT(*) as count
FROM items 
WHERE original_url IS NOT NULL;

-- Show a few examples
SELECT 
  id,
  title,
  original_url,
  created_at
FROM items 
WHERE original_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10; 