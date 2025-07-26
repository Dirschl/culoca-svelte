-- Prüfe ob die map_images_postgis Funktion in der Datenbank existiert

-- 1. Zeige alle Funktionen mit map_images im Namen
SELECT 
  routine_name,
  routine_type,
  security_type,
  data_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%map_images%'
ORDER BY routine_name;

-- 2. Teste ob die Funktion aufgerufen werden kann
SELECT 'Function exists test' as test, 
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM information_schema.routines 
           WHERE routine_name = 'map_images_postgis'
         ) THEN 'YES' 
         ELSE 'NO' 
       END as function_exists;

-- 3. Teste direkten Aufruf
SELECT 'Direct call test' as test, COUNT(*) as result_count
FROM map_images_postgis(0, 0, NULL);

-- 4. Zeige alle verfügbaren RPC-Funktionen
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name; 