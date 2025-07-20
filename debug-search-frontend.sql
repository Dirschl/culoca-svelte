-- Debug: Exakte Frontend-Abfrage simulieren
-- Diese Abfrage entspricht der SearchResults.svelte Logik

-- 1. Teste die exakte Abfrage ohne Volltext-Suche
SELECT 'EXAKTE FRONTEND-ABFRAGE (OHNE VOLLTEXT):' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  gallery,
  is_private,
  path_512,
  path_2048,
  path_64
FROM items_search_view 
WHERE gallery = true
AND (is_private = false OR is_private IS NULL)
AND search_text ILIKE '%burghausen%'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Teste mit Volltext-Suche (wie im Frontend)
SELECT 'EXAKTE FRONTEND-ABFRAGE (MIT VOLLTEXT):' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  gallery,
  is_private,
  path_512,
  path_2048,
  path_64
FROM items_search_view 
WHERE gallery = true
AND (is_private = false OR is_private IS NULL)
AND to_tsvector('german', search_text) @@ websearch_to_tsquery('german', 'burghausen')
ORDER BY created_at DESC
LIMIT 10;

-- 3. Teste Privacy-Filtering separat
SELECT 'PRIVACY FILTERING TEST:' as test;
SELECT 
  'total items' as filter,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'

UNION ALL

SELECT 
  'gallery = true' as filter,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true

UNION ALL

SELECT 
  'is_private = false' as filter,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND (is_private = false OR is_private IS NULL)

UNION ALL

SELECT 
  'both filters' as filter,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL);

-- 4. Teste path_512 Filtering
SELECT 'PATH_512 FILTERING TEST:' as test;
SELECT 
  'total with burghausen' as filter,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)

UNION ALL

SELECT 
  'with path_512' as filter,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NOT NULL;

-- 5. Zeige Items ohne path_512
SELECT 'ITEMS OHNE PATH_512:' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  path_512,
  path_2048,
  path_64
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NULL
LIMIT 5;

-- 6. Zeige finale Ergebnisse (wie Frontend)
SELECT 'FINALE ERGEBNISSE (WIE FRONTEND):' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  path_512,
  path_2048,
  path_64,
  gallery,
  is_private
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NOT NULL
ORDER BY created_at DESC
LIMIT 10; 