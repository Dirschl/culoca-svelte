-- Extended check for UTF-8 encoding issues in title and description fields
-- This script checks for various encoding problems

-- First, let's check what we're dealing with
SELECT 'Checking for various UTF-8 encoding issues...' as status;

-- Check for different possible encodings of German characters
SELECT 
  COUNT(*) as total_records_with_special_chars,
  COUNT(CASE WHEN title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' THEN 1 END) as correct_german_chars_in_title,
  COUNT(CASE WHEN description LIKE '%ä%' OR description LIKE '%ö%' OR description LIKE '%ü%' OR description LIKE '%ß%' THEN 1 END) as correct_german_chars_in_description
FROM items 
WHERE (title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' OR
       description LIKE '%ä%' OR description LIKE '%ö%' OR description LIKE '%ü%' OR description LIKE '%ß%');

-- Check for various possible wrong encodings
SELECT 
  'Possible wrong encodings:' as category,
  COUNT(CASE WHEN title LIKE '%Ã¤%' THEN 1 END) as title_a_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¶%' THEN 1 END) as title_o_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¼%' THEN 1 END) as title_u_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%ÃŸ%' THEN 1 END) as title_sharp_s_wrong,
  COUNT(CASE WHEN title LIKE '%Ã„%' THEN 1 END) as title_A_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%Ã–%' THEN 1 END) as title_O_umlaut_wrong,
  COUNT(CASE WHEN title LIKE '%Ãœ%' THEN 1 END) as title_U_umlaut_wrong
FROM items 
WHERE title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
      title LIKE '%Ã„%' OR title LIKE '%Ã–%' OR title LIKE '%Ãœ%'

UNION ALL

SELECT 
  'Description wrong encodings:' as category,
  COUNT(CASE WHEN description LIKE '%Ã¤%' THEN 1 END) as desc_a_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ã¶%' THEN 1 END) as desc_o_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ã¼%' THEN 1 END) as desc_u_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%ÃŸ%' THEN 1 END) as desc_sharp_s_wrong,
  COUNT(CASE WHEN description LIKE '%Ã„%' THEN 1 END) as desc_A_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ã–%' THEN 1 END) as desc_O_umlaut_wrong,
  COUNT(CASE WHEN description LIKE '%Ãœ%' THEN 1 END) as desc_U_umlaut_wrong
FROM items 
WHERE description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' OR
      description LIKE '%Ã„%' OR description LIKE '%Ã–%' OR description LIKE '%Ãœ%';

-- Check for other possible encoding issues
SELECT 
  'Other encoding issues:' as category,
  COUNT(CASE WHEN title LIKE '%Ã©%' THEN 1 END) as title_e_acute_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¨%' THEN 1 END) as title_e_grave_wrong,
  COUNT(CASE WHEN title LIKE '%Ã %' THEN 1 END) as title_a_grave_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¡%' THEN 1 END) as title_a_acute_wrong,
  COUNT(CASE WHEN title LIKE '%Ã³%' THEN 1 END) as title_o_acute_wrong,
  COUNT(CASE WHEN title LIKE '%Ã²%' THEN 1 END) as title_o_grave_wrong,
  COUNT(CASE WHEN title LIKE '%Ãº%' THEN 1 END) as title_u_acute_wrong,
  COUNT(CASE WHEN title LIKE '%Ã¹%' THEN 1 END) as title_u_grave_wrong,
  COUNT(CASE WHEN title LIKE '%Ã±%' THEN 1 END) as title_n_tilde_wrong,
  COUNT(CASE WHEN title LIKE '%Ã§%' THEN 1 END) as title_c_cedilla_wrong
FROM items 
WHERE title LIKE '%Ã©%' OR title LIKE '%Ã¨%' OR title LIKE '%Ã %' OR title LIKE '%Ã¡%' OR
      title LIKE '%Ã³%' OR title LIKE '%Ã²%' OR title LIKE '%Ãº%' OR title LIKE '%Ã¹%' OR
      title LIKE '%Ã±%' OR title LIKE '%Ã§%';

-- Show some examples of records with any special characters
SELECT 
  id,
  title,
  description,
  CASE 
    WHEN title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' THEN 'CORRECT_GERMAN'
    WHEN title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' THEN 'WRONG_ENCODING'
    WHEN title LIKE '%Ã©%' OR title LIKE '%Ã¨%' OR title LIKE '%Ã %' OR title LIKE '%Ã¡%' THEN 'OTHER_SPECIAL_CHARS'
    ELSE 'NO_SPECIAL_CHARS'
  END as encoding_status
FROM items 
WHERE (title LIKE '%ä%' OR title LIKE '%ö%' OR title LIKE '%ü%' OR title LIKE '%ß%' OR
       title LIKE '%Ã¤%' OR title LIKE '%Ã¶%' OR title LIKE '%Ã¼%' OR title LIKE '%ÃŸ%' OR
       title LIKE '%Ã©%' OR title LIKE '%Ã¨%' OR title LIKE '%Ã %' OR title LIKE '%Ã¡%' OR
       description LIKE '%ä%' OR description LIKE '%ö%' OR description LIKE '%ü%' OR description LIKE '%ß%' OR
       description LIKE '%Ã¤%' OR description LIKE '%Ã¶%' OR description LIKE '%Ã¼%' OR description LIKE '%ÃŸ%' OR
       description LIKE '%Ã©%' OR description LIKE '%Ã¨%' OR description LIKE '%Ã %' OR description LIKE '%Ã¡%')
ORDER BY id
LIMIT 20;

-- Check for any records with non-ASCII characters
SELECT 
  COUNT(*) as records_with_non_ascii,
  COUNT(CASE WHEN title ~ '[^\x00-\x7F]' THEN 1 END) as title_with_non_ascii,
  COUNT(CASE WHEN description ~ '[^\x00-\x7F]' THEN 1 END) as description_with_non_ascii
FROM items 
WHERE title ~ '[^\x00-\x7F]' OR description ~ '[^\x00-\x7F]';

-- Show examples of records with any non-ASCII characters
SELECT 
  id,
  title,
  description,
  'NON_ASCII_CHARS' as encoding_status
FROM items 
WHERE title ~ '[^\x00-\x7F]' OR description ~ '[^\x00-\x7F]'
ORDER BY id
LIMIT 10;

-- Check if the issue might be in the frontend display only
SELECT 
  'Records with German words that might have encoding issues:' as category,
  COUNT(CASE WHEN title ILIKE '%straße%' THEN 1 END) as title_strasse,
  COUNT(CASE WHEN title ILIKE '%müller%' THEN 1 END) as title_mueller,
  COUNT(CASE WHEN title ILIKE '%köln%' THEN 1 END) as title_koeln,
  COUNT(CASE WHEN title ILIKE '%düsseldorf%' THEN 1 END) as title_duesseldorf,
  COUNT(CASE WHEN title ILIKE '%bäcker%' THEN 1 END) as title_baecker,
  COUNT(CASE WHEN title ILIKE '%größer%' THEN 1 END) as title_groesser
FROM items 
WHERE title ILIKE '%straße%' OR title ILIKE '%müller%' OR title ILIKE '%köln%' OR 
      title ILIKE '%düsseldorf%' OR title ILIKE '%bäcker%' OR title ILIKE '%größer%';

-- Show some examples of German words in titles
SELECT 
  id,
  title,
  CASE 
    WHEN title ILIKE '%straße%' THEN 'STRASSE'
    WHEN title ILIKE '%müller%' THEN 'MUELLER'
    WHEN title ILIKE '%köln%' THEN 'KOELN'
    WHEN title ILIKE '%düsseldorf%' THEN 'DUESSELDORF'
    WHEN title ILIKE '%bäcker%' THEN 'BAECKER'
    WHEN title ILIKE '%größer%' THEN 'GROESSER'
    ELSE 'OTHER'
  END as german_word_type
FROM items 
WHERE title ILIKE '%straße%' OR title ILIKE '%müller%' OR title ILIKE '%köln%' OR 
      title ILIKE '%düsseldorf%' OR title ILIKE '%bäcker%' OR title ILIKE '%größer%'
ORDER BY id
LIMIT 10;

SELECT 'Extended UTF-8 encoding check completed!' as status; 