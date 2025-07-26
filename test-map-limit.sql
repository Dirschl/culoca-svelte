-- Test um herauszufinden, wo die 1000er Begrenzung herkommt

-- 1. Teste direkte Abfrage ohne Funktion
SELECT COUNT(*) as direct_query_count
FROM items 
WHERE gallery = true 
  AND lat IS NOT NULL 
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
  AND (is_private = false OR is_private IS NULL);

-- 2. Teste PostGIS-Funktion
SELECT COUNT(*) as postgis_function_count
FROM map_images_postgis(0, 0, NULL);

-- 3. Teste mit LIMIT um zu sehen, ob es ein verstecktes Limit gibt
SELECT COUNT(*) as limited_count
FROM (
  SELECT * FROM map_images_postgis(0, 0, NULL) LIMIT 2000
) t;

-- 4. Teste RLS-Policies
SELECT COUNT(*) as rls_count
FROM items 
WHERE gallery = true 
  AND lat IS NOT NULL 
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
  AND (is_private = false OR is_private IS NULL);

-- 5. Teste mit SECURITY DEFINER
-- (Falls die Funktion mit SECURITY DEFINER erstellt wurde)
SELECT COUNT(*) as security_definer_count
FROM map_images_postgis(0, 0, NULL);

-- 6. Zeige alle verfügbaren Funktionen
SELECT routine_name, routine_type, security_type
FROM information_schema.routines 
WHERE routine_name LIKE '%map_images%'; 