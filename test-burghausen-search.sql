-- Test SQL Script für Burghausen-Suche
-- Debug der Suchfunktionalität

-- 1. Zuerst schauen wir uns die Datenstruktur an
SELECT '=== DATENSTRUKTUR ===' as info;

-- Zeige alle Spalten der items Tabelle
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'items' 
AND column_name IN ('title', 'description', 'keywords', 'gallery', 'is_private')
ORDER BY ordinal_position;

-- 2. Teste die aktuelle items_search_view
SELECT '=== AKTUELLE VIEW TEST ===' as info;

-- Zeige die View-Definition
SELECT view_definition 
FROM information_schema.views 
WHERE table_name = 'items_search_view';

-- 3. Teste die Daten direkt
SELECT '=== ROHDATEN TEST ===' as info;

-- Zeige alle Items mit Burghausen in title, description oder keywords
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
LIMIT 10;

-- 4. Teste die View-Funktionalität
SELECT '=== VIEW FUNKTIONALITÄT ===' as info;

-- Zeige search_text von der View
SELECT 
  id,
  title,
  description,
  keywords,
  search_text,
  LENGTH(search_text) as search_text_length
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
LIMIT 10;

-- 5. Teste Volltext-Suche
SELECT '=== VOLLTEXT-SUCHE TEST ===' as info;

-- Teste verschiedene Suchmethoden
SELECT 
  'Method 1: ILIKE' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'

UNION ALL

SELECT 
  'Method 2: to_tsvector' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE to_tsvector('german', search_text) @@ to_tsquery('german', 'burghausen')

UNION ALL

SELECT 
  'Method 3: websearch_to_tsquery' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE to_tsvector('german', search_text) @@ websearch_to_tsquery('german', 'burghausen')

UNION ALL

SELECT 
  'Method 4: plainto_tsquery' as method,
  COUNT(*) as count
FROM items_search_view 
WHERE to_tsvector('german', search_text) @@ plainto_tsquery('german', 'burghausen');

-- 6. Debug: Zeige Beispiele von search_text
SELECT '=== SEARCH_TEXT BEISPIELE ===' as info;

SELECT 
  id,
  title,
  description,
  keywords,
  search_text
FROM items_search_view 
WHERE search_text != ''
ORDER BY LENGTH(search_text) DESC
LIMIT 5;

-- 7. Teste Array-Funktionalität
SELECT '=== ARRAY FUNKTIONALITÄT ===' as info;

-- Zeige wie keywords Arrays konvertiert werden
SELECT 
  id,
  keywords,
  array_to_string(keywords, ' ') as keywords_string,
  CASE 
    WHEN keywords IS NULL THEN 'NULL'
    WHEN keywords = '{}' THEN 'EMPTY'
    ELSE 'HAS_DATA'
  END as keywords_status
FROM items 
WHERE keywords IS NOT NULL
LIMIT 5;

-- 8. Teste spezifische Burghausen-Suche
SELECT '=== BURGHAUSEN SPEZIFISCH ===' as info;

-- Suche nach verschiedenen Schreibweisen
SELECT 
  'title contains' as source,
  COUNT(*) as count
FROM items 
WHERE title ILIKE '%burghausen%'

UNION ALL

SELECT 
  'description contains' as source,
  COUNT(*) as count
FROM items 
WHERE description ILIKE '%burghausen%'

UNION ALL

SELECT 
  'keywords array contains' as source,
  COUNT(*) as count
FROM items 
WHERE keywords IS NOT NULL AND keywords && ARRAY['Burghausen', 'burghausen', 'BURGHAUSEN'];

-- 9. Zeige alle Items mit Burghausen in search_text
SELECT '=== FINALE BURGHAUSEN ERGEBNISSE ===' as info;

SELECT 
  id,
  title,
  description,
  keywords,
  search_text
FROM items_search_view 
WHERE search_text ILIKE '%burghausen%'
ORDER BY created_at DESC; 