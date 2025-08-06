-- Test various UTF-8 encoding queries
-- This script tests different ways to find encoding issues

-- Your specific query
SELECT 'Testing your query: title like %Ã¼%' as test_name;
SELECT COUNT(*) as count_with_u_umlaut_wrong FROM items WHERE title LIKE '%Ã¼%';

-- Test other common wrong encodings
SELECT 'Testing other wrong encodings:' as test_name;
SELECT 
  COUNT(CASE WHEN title LIKE '%Ã¤%' THEN 1 END) as a_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¶%' THEN 1 END) as o_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¼%' THEN 1 END) as u_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%ÃŸ%' THEN 1 END) as sharp_s_wrong
FROM items;

-- Test correct German characters
SELECT 'Testing correct German characters:' as test_name;
SELECT 
  COUNT(CASE WHEN title LIKE '%ä%' THEN 1 END) as a_umlaut_correct,
  COUNT(CASE WHEN title LIKE '%ö%' THEN 1 END) as o_umlaut_correct,
  COUNT(CASE WHEN title LIKE '%ü%' THEN 1 END) as u_umlaut_correct,
  COUNT(CASE WHEN title LIKE '%ß%' THEN 1 END) as sharp_s_correct
FROM items;

-- Show some examples of records with any special characters
SELECT 'Examples of records with special characters:' as test_name;
SELECT 
  id,
  title,
  CASE 
    WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 'WRONG_ENCODING'
    WHEN title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' THEN 'CORRECT_ENCODING'
    ELSE 'NO_SPECIAL_CHARS'
  END as encoding_status
FROM items 
WHERE title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
      title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%'
ORDER BY id
LIMIT 10;

-- Test with description field too
SELECT 'Testing description field:' as test_name;
SELECT 
  COUNT(CASE WHEN description LIKE '%Ã¤%' THEN 1 END) as desc_a_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ã¶%' THEN 1 END) as desc_o_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ã¼%' THEN 1 END) as desc_u_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%ÃŸ%' THEN 1 END) as desc_sharp_s_wrong
FROM items 
WHERE description IS NOT NULL;

-- Test with your exact query but for all fields
SELECT 'Your query applied to all fields:' as test_name;
SELECT 
  COUNT(CASE WHEN title LIKE '%Ã¼%' THEN 1 END) as title_u_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ã¼%' THEN 1 END) as desc_u_umlaut_wrong
FROM items;

-- Show actual examples if any exist
SELECT 'Actual examples with Ã¼ in title:' as test_name;
SELECT id, title FROM items WHERE title LIKE '%Ã¼%' LIMIT 5;

SELECT 'Actual examples with Ã¼ in description:' as test_name;
SELECT id, description FROM items WHERE description LIKE '%Ã¼%' LIMIT 5;

SELECT 'Test completed!' as status; 