-- Test der map_images_postgis Funktionen
-- Führe diese Abfrage in Supabase aus

-- 1. Prüfe ob die Funktionen existieren
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN ('map_images_postgis', 'map_images_postgis_simple')
ORDER BY routine_name;

-- 2. Teste die Funktionen mit verschiedenen Parameter-Kombinationen
-- Test 1: Mit allen Parametern
SELECT 'Test 1: Mit allen Parametern' as test_name;
SELECT COUNT(*) as count FROM map_images_postgis(0, 0, NULL);

-- Test 2: Mit nur lat/lon (ohne user_id)
SELECT 'Test 2: Mit nur lat/lon' as test_name;
SELECT COUNT(*) as count FROM map_images_postgis(0, 0);

-- Test 3: Simple Funktion mit allen Parametern
SELECT 'Test 3: Simple Funktion mit allen Parametern' as test_name;
SELECT COUNT(*) as count FROM map_images_postgis_simple(0, 0, NULL);

-- Test 4: Simple Funktion mit nur lat/lon
SELECT 'Test 4: Simple Funktion mit nur lat/lon' as test_name;
SELECT COUNT(*) as count FROM map_images_postgis_simple(0, 0);

-- 3. Prüfe die Datenbasis
SELECT 'Datenbasis-Check:' as test_name;
SELECT 
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE gallery = true) as gallery_items,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL) as with_gps,
  COUNT(*) FILTER (WHERE path_64 IS NOT NULL) as with_64px,
  COUNT(*) FILTER (WHERE is_private = false OR is_private IS NULL) as public_items
FROM items; 