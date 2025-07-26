-- Prüfe Supabase-Limits und RLS-Policies

-- 1. Zeige alle RLS-Policies für die items Tabelle
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'items';

-- 2. Prüfe ob RLS aktiviert ist
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'items';

-- 3. Zeige alle Funktionen mit map_images im Namen
SELECT 
  routine_name,
  routine_type,
  security_type,
  data_type
FROM information_schema.routines 
WHERE routine_name LIKE '%map_images%'
ORDER BY routine_name;

-- 4. Teste verschiedene Abfragen um Limits zu finden
-- Test 1: Direkte Abfrage
SELECT 'Direct query' as test_type, COUNT(*) as count
FROM items 
WHERE gallery = true 
  AND lat IS NOT NULL 
  AND lon IS NOT NULL
  AND path_64 IS NOT NULL
  AND (is_private = false OR is_private IS NULL);

-- Test 2: Mit OFFSET/LIMIT
SELECT 'With LIMIT 2000' as test_type, COUNT(*) as count
FROM (
  SELECT * FROM items 
  WHERE gallery = true 
    AND lat IS NOT NULL 
    AND lon IS NOT NULL
    AND path_64 IS NOT NULL
    AND (is_private = false OR is_private IS NULL)
  LIMIT 2000
) t;

-- Test 3: PostGIS-Funktion
SELECT 'PostGIS function' as test_type, COUNT(*) as count
FROM map_images_postgis(0, 0, NULL);

-- Test 4: PostGIS-Funktion mit LIMIT
SELECT 'PostGIS with LIMIT 2000' as test_type, COUNT(*) as count
FROM (
  SELECT * FROM map_images_postgis(0, 0, NULL) LIMIT 2000
) t; 