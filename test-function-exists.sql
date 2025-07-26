-- Prüfe ob map_images_postgis existiert

SELECT 'Function exists' as test, 
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM information_schema.routines 
           WHERE routine_name = 'map_images_postgis'
         ) THEN 'YES' 
         ELSE 'NO' 
       END as result; 