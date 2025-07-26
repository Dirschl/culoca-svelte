-- Test der map_images_postgis Funktion
-- Führe diese Abfrage in Supabase aus, um zu testen

-- 1. Prüfe ob die Funktion existiert
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'map_images_postgis';

-- 2. Teste die Funktion mit Standard-Parametern
SELECT * FROM map_images_postgis(0, 0, NULL) LIMIT 5;

-- 3. Prüfe ob überhaupt Daten vorhanden sind
SELECT COUNT(*) as total_images,
       COUNT(*) FILTER (WHERE gallery = true) as gallery_images,
       COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL) as with_gps,
       COUNT(*) FILTER (WHERE path_64 IS NOT NULL) as with_64px
FROM items;

-- 4. Teste direkte Abfrage ohne Funktion
SELECT id, slug, path_64, title, lat, lon
FROM items
WHERE path_512 IS NOT NULL
  AND gallery = true
  AND lat IS NOT NULL
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
  AND (is_private = false OR is_private IS NULL)
LIMIT 5; 