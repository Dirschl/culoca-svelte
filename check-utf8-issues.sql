-- Check for UTF-8 encoding issues in title and description fields
-- This script shows how many records are affected and displays examples

-- First, let's check what we're dealing with
SELECT 'Checking for UTF-8 encoding issues...' as status;

-- Count problematic records
SELECT 
  COUNT(*) as total_problematic_records,
  COUNT(CASE WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 1 END) as problematic_titles,
  COUNT(CASE WHEN description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' THEN 1 END) as problematic_descriptions
FROM items 
WHERE (title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%');

-- Show examples of problematic data
SELECT 
  id,
  title,
  description,
  CASE 
    WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 'PROBLEMATIC_TITLE'
    WHEN description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' THEN 'PROBLEMATIC_DESCRIPTION'
    ELSE 'OK'
  END as encoding_status
FROM items 
WHERE (title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%')
ORDER BY id
LIMIT 20;

-- Check EXIF data caption field
SELECT 
  COUNT(*) as exif_caption_problematic_records
FROM items 
WHERE exif_data IS NOT NULL 
  AND exif_data->>'Caption' IS NOT NULL
  AND (exif_data->>'Caption' LIKE '%Ã¤%' OR exif_data->>'Caption' LIKE '%Ã¶%' OR 
       exif_data->>'Caption' LIKE '%Ã¼%' OR exif_data->>'Caption' LIKE '%ÃŸ%');

-- Show examples of problematic EXIF captions
SELECT 
  id,
  exif_data->>'Caption' as caption,
  'PROBLEMATIC_EXIF_CAPTION' as encoding_status
FROM items 
WHERE exif_data IS NOT NULL 
  AND exif_data->>'Caption' IS NOT NULL
  AND (exif_data->>'Caption' LIKE '%Ã¤%' OR exif_data->>'Caption' LIKE '%Ã¶%' OR 
       exif_data->>'Caption' LIKE '%Ã¼%' OR exif_data->>'Caption' LIKE '%ÃŸ%')
ORDER BY id
LIMIT 10;

-- Show breakdown by specific problematic characters
SELECT 
  'Title issues:' as category,
  COUNT(CASE WHEN title LIKE '%Ã¤%' THEN 1 END) as a_umlaut,
  COUNT(CASE WHEN title LIKE '%Ã¶%' THEN 1 END) as o_umlaut,
  COUNT(CASE WHEN title LIKE '%Ã¼%' THEN 1 END) as u_umlaut,
  COUNT(CASE WHEN title LIKE '%ÃŸ%' THEN 1 END) as sharp_s
FROM items 
WHERE title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%'

UNION ALL

SELECT 
  'Description issues:' as category,
  COUNT(CASE WHEN description LIKE '%Ã¤%' THEN 1 END) as a_umlaut,
  COUNT(CASE WHEN description LIKE '%Ã¶%' THEN 1 END) as o_umlaut,
  COUNT(CASE WHEN description LIKE '%Ã¼%' THEN 1 END) as u_umlaut,
  COUNT(CASE WHEN description LIKE '%ÃŸ%' THEN 1 END) as sharp_s
FROM items 
WHERE description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%'

UNION ALL

SELECT 
  'EXIF Caption issues:' as category,
  COUNT(CASE WHEN exif_data->>'Caption' LIKE '%Ã¤%' THEN 1 END) as a_umlaut,
  COUNT(CASE WHEN exif_data->>'Caption' LIKE '%Ã¶%' THEN 1 END) as o_umlaut,
  COUNT(CASE WHEN exif_data->>'Caption' LIKE '%Ã¼%' THEN 1 END) as u_umlaut,
  COUNT(CASE WHEN exif_data->>'Caption' LIKE '%ÃŸ%' THEN 1 END) as sharp_s
FROM items 
WHERE exif_data IS NOT NULL 
  AND exif_data->>'Caption' IS NOT NULL
  AND (exif_data->>'Caption' LIKE '%Ã¤%' OR exif_data->>'Caption' LIKE '%Ã¶%' OR 
       exif_data->>'Caption' LIKE '%Ã¼%' OR exif_data->>'Caption' LIKE '%ÃŸ%');

-- Show some examples of what the fixed data would look like
SELECT 
  id,
  title as original_title,
  title
    .replace('Ã¤', 'ä')
    .replace('Ã¶', 'ö') 
    .replace('Ã¼', 'ü')
    .replace('ÃŸ', 'ß')
    .replace('Ã„', 'Ä')
    .replace('Ã–', 'Ö')
    .replace('Ãœ', 'Ü') as fixed_title,
  description as original_description,
  description
    .replace('Ã¤', 'ä')
    .replace('Ã¶', 'ö') 
    .replace('Ã¼', 'ü')
    .replace('ÃŸ', 'ß')
    .replace('Ã„', 'Ä')
    .replace('Ã–', 'Ö')
    .replace('Ãœ', 'Ü') as fixed_description
FROM items 
WHERE (title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%')
ORDER BY id
LIMIT 10;

SELECT 'UTF-8 encoding check completed!' as status; 