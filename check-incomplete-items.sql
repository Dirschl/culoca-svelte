-- Check for incomplete data rows and their causes
-- This helps identify what went wrong during upload processing

-- 1. Items missing path_2048 (like your one missing item)
SELECT 
  id,
  created_at,
  original_name,
  path_512,
  path_2048,
  lat,
  lon,
  status,
  error_message,
  'Missing path_2048' as issue_type
FROM items 
WHERE path_512 IS NOT NULL 
  AND path_2048 IS NULL
ORDER BY created_at DESC;

-- 2. Items missing path_512 (more serious issue)
SELECT 
  id,
  created_at,
  original_name,
  path_512,
  path_2048,
  lat,
  lon,
  status,
  error_message,
  'Missing path_512' as issue_type
FROM items 
WHERE path_512 IS NULL
ORDER BY created_at DESC;

-- 3. Items missing GPS coordinates
SELECT 
  id,
  created_at,
  original_name,
  path_512,
  path_2048,
  lat,
  lon,
  status,
  error_message,
  'Missing GPS coordinates' as issue_type
FROM items 
WHERE (lat IS NULL OR lon IS NULL)
  AND path_512 IS NOT NULL
ORDER BY created_at DESC;

-- 4. Items with processing status still set to 'processing'
SELECT 
  id,
  created_at,
  original_name,
  path_512,
  path_2048,
  lat,
  lon,
  status,
  error_message,
  'Still processing' as issue_type
FROM items 
WHERE status = 'processing'
ORDER BY created_at DESC;

-- 5. Items with error messages
SELECT 
  id,
  created_at,
  original_name,
  path_512,
  path_2048,
  lat,
  lon,
  status,
  error_message,
  'Has error message' as issue_type
FROM items 
WHERE error_message IS NOT NULL
ORDER BY created_at DESC;

-- 6. Summary of all issues
SELECT 
  'Missing path_2048' as issue_type,
  COUNT(*) as count
FROM items 
WHERE path_512 IS NOT NULL AND path_2048 IS NULL

UNION ALL

SELECT 
  'Missing path_512' as issue_type,
  COUNT(*) as count
FROM items 
WHERE path_512 IS NULL

UNION ALL

SELECT 
  'Missing GPS coordinates' as issue_type,
  COUNT(*) as count
FROM items 
WHERE (lat IS NULL OR lon IS NULL) AND path_512 IS NOT NULL

UNION ALL

SELECT 
  'Still processing' as issue_type,
  COUNT(*) as count
FROM items 
WHERE status = 'processing'

UNION ALL

SELECT 
  'Has error message' as issue_type,
  COUNT(*) as count
FROM items 
WHERE error_message IS NOT NULL

UNION ALL

SELECT 
  'Complete items' as issue_type,
  COUNT(*) as count
FROM items 
WHERE path_512 IS NOT NULL 
  AND path_2048 IS NOT NULL 
  AND lat IS NOT NULL 
  AND lon IS NOT NULL; 