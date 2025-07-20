-- Debug: Frontend-Filter Schritt für Schritt testen
-- Identifiziere welcher Filter die Ergebnisse von 80 auf 2 reduziert

-- 1. Basis: Alle Items mit Burghausen
SELECT 'SCHRITT 1: ALLE BURGHAUSEN ITEMS' as test;
SELECT COUNT(*) as total_burghausen_items
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%';

-- 2. Filter: gallery = true
SELECT 'SCHRITT 2: NUR GALLERY = TRUE' as test;
SELECT COUNT(*) as gallery_true_items
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true;

-- 3. Filter: is_private = false
SELECT 'SCHRITT 3: NUR IS_PRIVATE = FALSE' as test;
SELECT COUNT(*) as public_items
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL);

-- 4. Filter: path_512 IS NOT NULL
SELECT 'SCHRITT 4: NUR MIT PATH_512' as test;
SELECT COUNT(*) as with_path_512
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NOT NULL;

-- 5. Volltext-Suche Test
SELECT 'SCHRITT 5: VOLLTEXT-SUCHE TEST' as test;
SELECT COUNT(*) as fulltext_results
FROM items_search_view 
WHERE gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NOT NULL
AND to_tsvector('german', search_text) @@ websearch_to_tsquery('german', 'burghausen');

-- 6. Detaillierte Analyse der Filter
SELECT 'SCHRITT 6: DETAILLIERTE FILTER-ANALYSE' as test;
SELECT 
  'gallery = true' as filter_name,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true

UNION ALL

SELECT 
  'is_private = false' as filter_name,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)

UNION ALL

SELECT 
  'path_512 IS NOT NULL' as filter_name,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
AND gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NOT NULL

UNION ALL

SELECT 
  'Volltext-Suche' as filter_name,
  COUNT(*) as count
FROM items_search_view 
WHERE gallery = true
AND (is_private = false OR is_private IS NULL)
AND path_512 IS NOT NULL
AND to_tsvector('german', search_text) @@ websearch_to_tsquery('german', 'burghausen');

-- 7. Zeige die finalen 2 Ergebnisse
SELECT 'SCHRITT 7: FINALE 2 ERGEBNISSE' as test;
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
AND path_512 IS NOT NULL
AND to_tsvector('german', search_text) @@ websearch_to_tsquery('german', 'burghausen')
ORDER BY created_at DESC; 