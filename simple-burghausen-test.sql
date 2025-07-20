-- Einfacher Test für Burghausen-Suche
-- Führe das in Supabase SQL Editor aus

-- 1. Teste die aktuelle View
SELECT 'AKTUELLE VIEW:' as test;
SELECT COUNT(*) as total_items FROM items_search_view;
SELECT COUNT(*) as items_with_search_text FROM items_search_view WHERE search_text != '';

-- 2. Teste Burghausen in den Rohdaten
SELECT 'BURGHAUSEN IN ROHDATEN:' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  gallery,
  is_private
FROM items 
WHERE 
  title ILIKE '%burghausen%' OR
  description ILIKE '%burghausen%' OR
  (keywords IS NOT NULL AND keywords && ARRAY['Burghausen', 'burghausen'])
LIMIT 5;

-- 3. Teste Burghausen in der View
SELECT 'BURGHAUSEN IN VIEW:' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  search_text
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
LIMIT 5;

-- 4. Teste verschiedene Suchmethoden
SELECT 'SUCHMETHODEN VERGLEICH:' as test;
SELECT 
  'ILIKE' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'

UNION ALL

SELECT 
  'to_tsvector' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE to_tsvector('german', search_text) @@ to_tsquery('german', 'burghausen')

UNION ALL

SELECT 
  'websearch_to_tsquery' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE to_tsvector('german', search_text) @@ websearch_to_tsquery('german', 'burghausen');

-- 5. Zeige Beispiele von search_text
SELECT 'SEARCH_TEXT BEISPIELE:' as test;
SELECT 
  id,
  title,
  description,
  keywords,
  search_text
FROM items_search_view 
WHERE search_text != ''
ORDER BY LENGTH(search_text) DESC
LIMIT 3; 