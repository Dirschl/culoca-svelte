-- Fix UTF-8 encoding issues in title and description fields
-- This script converts incorrectly encoded UTF-8 characters back to proper German characters

-- First, let's check what we're dealing with
SELECT 'Checking for UTF-8 encoding issues...' as status;

-- Show examples of problematic data
SELECT 
  id,
  title,
  description,
  CASE 
    WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 'PROBLEMATIC'
    WHEN description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' THEN 'PROBLEMATIC'
    ELSE 'OK'
  END as encoding_status
FROM items 
WHERE (title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%')
LIMIT 10;

-- Count problematic records
SELECT 
  COUNT(*) as total_problematic_records,
  COUNT(CASE WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 1 END) as problematic_titles,
  COUNT(CASE WHEN description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' THEN 1 END) as problematic_descriptions
FROM items 
WHERE (title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%');

-- Fix UTF-8 encoding issues in title field
UPDATE items 
SET title = 
  CASE 
    WHEN title IS NOT NULL THEN
      title
        -- Fix common UTF-8 encoding issues
        .replace('Ã¤', 'ä')
        .replace('Ã¶', 'ö') 
        .replace('Ã¼', 'ü')
        .replace('ÃŸ', 'ß')
        .replace('Ã„', 'Ä')
        .replace('Ã–', 'Ö')
        .replace('Ãœ', 'Ü')
        -- Fix other common issues
        .replace('Ã©', 'é')
        .replace('Ã¨', 'è')
        .replace('Ã ', 'à')
        .replace('Ã¡', 'á')
        .replace('Ã³', 'ó')
        .replace('Ã²', 'ò')
        .replace('Ãº', 'ú')
        .replace('Ã¹', 'ù')
        .replace('Ã±', 'ñ')
        .replace('Ã§', 'ç')
    ELSE title
  END
WHERE title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
      title LIKE '%Ã„%' OR title LIKE '%Ã–%' OR title LIKE '%Ãœ%' OR
      title LIKE '%Ã©%' OR title LIKE '%Ã¨%' OR title LIKE '%Ã %' OR
      title LIKE '%Ã¡%' OR title LIKE '%Ã³%' OR title LIKE '%Ã²%' OR
      title LIKE '%Ãº%' OR title LIKE '%Ã¹%' OR title LIKE '%Ã±%' OR
      title LIKE '%Ã§%';

-- Fix UTF-8 encoding issues in description field
UPDATE items 
SET description = 
  CASE 
    WHEN description IS NOT NULL THEN
      description
        -- Fix common UTF-8 encoding issues
        .replace('Ã¤', 'ä')
        .replace('Ã¶', 'ö') 
        .replace('Ã¼', 'ü')
        .replace('ÃŸ', 'ß')
        .replace('Ã„', 'Ä')
        .replace('Ã–', 'Ö')
        .replace('Ãœ', 'Ü')
        -- Fix other common issues
        .replace('Ã©', 'é')
        .replace('Ã¨', 'è')
        .replace('Ã ', 'à')
        .replace('Ã¡', 'á')
        .replace('Ã³', 'ó')
        .replace('Ã²', 'ò')
        .replace('Ãº', 'ú')
        .replace('Ã¹', 'ù')
        .replace('Ã±', 'ñ')
        .replace('Ã§', 'ç')
    ELSE description
  END
WHERE description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' OR
      description LIKE '%Ã„%' OR description LIKE '%Ã–%' OR description LIKE '%Ãœ%' OR
      description LIKE '%Ã©%' OR description LIKE '%Ã¨%' OR description LIKE '%Ã %' OR
      description LIKE '%Ã¡%' OR description LIKE '%Ã³%' OR description LIKE '%Ã²%' OR
      description LIKE '%Ãº%' OR description LIKE '%Ã¹%' OR description LIKE '%Ã±%' OR
      description LIKE '%Ã§%';

-- Also fix EXIF data caption field if it exists
UPDATE items 
SET exif_data = 
  CASE 
    WHEN exif_data IS NOT NULL AND exif_data->>'Caption' IS NOT NULL THEN
      jsonb_set(
        exif_data,
        '{Caption}',
        to_jsonb(
          exif_data->>'Caption'
            .replace('Ã¤', 'ä')
            .replace('Ã¶', 'ö') 
            .replace('Ã¼', 'ü')
            .replace('ÃŸ', 'ß')
            .replace('Ã„', 'Ä')
            .replace('Ã–', 'Ö')
            .replace('Ãœ', 'Ü')
            .replace('Ã©', 'é')
            .replace('Ã¨', 'è')
            .replace('Ã ', 'à')
            .replace('Ã¡', 'á')
            .replace('Ã³', 'ó')
            .replace('Ã²', 'ò')
            .replace('Ãº', 'ú')
            .replace('Ã¹', 'ù')
            .replace('Ã±', 'ñ')
            .replace('Ã§', 'ç')
        )
      )
    ELSE exif_data
  END
WHERE exif_data IS NOT NULL 
  AND exif_data->>'Caption' IS NOT NULL
  AND (exif_data->>'Caption' LIKE '%Ã¤%' OR exif_data->>'Caption' LIKE '%Ã¶%' OR 
       exif_data->>'Caption' LIKE '%Ã¼%' OR exif_data->>'Caption' LIKE '%ÃŸ%' OR
       exif_data->>'Caption' LIKE '%Ã„%' OR exif_data->>'Caption' LIKE '%Ã–%' OR 
       exif_data->>'Caption' LIKE '%Ãœ%' OR exif_data->>'Caption' LIKE '%Ã©%' OR
       exif_data->>'Caption' LIKE '%Ã¨%' OR exif_data->>'Caption' LIKE '%Ã %' OR
       exif_data->>'Caption' LIKE '%Ã¡%' OR exif_data->>'Caption' LIKE '%Ã³%' OR
       exif_data->>'Caption' LIKE '%Ã²%' OR exif_data->>'Caption' LIKE '%Ãº%' OR
       exif_data->>'Caption' LIKE '%Ã¹%' OR exif_data->>'Caption' LIKE '%Ã±%' OR
       exif_data->>'Caption' LIKE '%Ã§%');

-- Verify the fixes
SELECT 'Verification - checking for remaining UTF-8 issues...' as status;

-- Check if any problematic records remain
SELECT 
  COUNT(*) as remaining_problematic_records,
  COUNT(CASE WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 1 END) as remaining_problematic_titles,
  COUNT(CASE WHEN description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' THEN 1 END) as remaining_problematic_descriptions
FROM items 
WHERE (title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%');

-- Show some examples of fixed data
SELECT 
  id,
  title,
  description,
  CASE 
    WHEN title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' THEN 'FIXED'
    WHEN description LIKE '%ä%' OR description LIKE '%ö%' OR description LIKE '%ü%' OR description LIKE '%ß%' THEN 'FIXED'
    ELSE 'NO_SPECIAL_CHARS'
  END as status
FROM items 
WHERE (title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' OR
       description LIKE '%ä%' OR description LIKE '%ö%' OR description LIKE '%ü%' OR description LIKE '%ß%')
LIMIT 10;

SELECT 'UTF-8 encoding fix completed!' as status; 