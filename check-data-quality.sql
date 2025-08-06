-- Check data quality for Google Rich Snippets
-- This script helps identify items with problematic titles/descriptions

-- 1. Items with missing titles
SELECT 
  'Missing Title' as issue_type,
  id,
  slug,
  title,
  description,
  original_name,
  created_at
FROM items 
WHERE title IS NULL OR title = '' OR title = 'null'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Items with missing descriptions
SELECT 
  'Missing Description' as issue_type,
  id,
  slug,
  title,
  description,
  original_name,
  created_at
FROM items 
WHERE description IS NULL OR description = '' OR description = 'null'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Items with very short titles (less than 10 characters)
SELECT 
  'Short Title' as issue_type,
  id,
  slug,
  title,
  description,
  original_name,
  created_at
FROM items 
WHERE LENGTH(title) < 10 AND title IS NOT NULL AND title != ''
ORDER BY created_at DESC
LIMIT 10;

-- 4. Items with very long titles (more than 100 characters)
SELECT 
  'Long Title' as issue_type,
  id,
  slug,
  title,
  description,
  original_name,
  created_at
FROM items 
WHERE LENGTH(title) > 100 AND title IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Items with problematic characters in titles
SELECT 
  'Special Characters in Title' as issue_type,
  id,
  slug,
  title,
  description,
  original_name,
  created_at
FROM items 
WHERE title ~ '[<>"&]' AND title IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 6. Items with missing image paths
SELECT 
  'Missing Image Paths' as issue_type,
  id,
  slug,
  title,
  description,
  path_512,
  path_2048,
  original_name,
  created_at
FROM items 
WHERE (path_512 IS NULL OR path_512 = '') AND (path_2048 IS NULL OR path_2048 = '')
ORDER BY created_at DESC
LIMIT 10;

-- 7. Items with only 512px images (no 2048px)
SELECT 
  'Only 512px Image' as issue_type,
  id,
  slug,
  title,
  description,
  path_512,
  path_2048,
  original_name,
  created_at
FROM items 
WHERE (path_512 IS NOT NULL AND path_512 != '') AND (path_2048 IS NULL OR path_2048 = '')
ORDER BY created_at DESC
LIMIT 10;

-- 8. Summary statistics
SELECT 
  'Summary' as info_type,
  COUNT(*) as total_items,
  COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as missing_titles,
  COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_descriptions,
  COUNT(CASE WHEN path_512 IS NULL OR path_512 = '' THEN 1 END) as missing_512px,
  COUNT(CASE WHEN path_2048 IS NULL OR path_2048 = '' THEN 1 END) as missing_2048px,
  COUNT(CASE WHEN (path_512 IS NOT NULL AND path_512 != '') AND (path_2048 IS NULL OR path_2048 = '') THEN 1 END) as only_512px
FROM items; 