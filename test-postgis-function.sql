-- Test PostGIS Function Availability
-- Run this in Supabase SQL Editor to check if functions exist

-- 1. Check if the function exists
SELECT 
  routine_name, 
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'gallery_items_normal_postgis'
AND routine_schema = 'public';

-- 2. Check function parameters
SELECT 
  parameter_name,
  parameter_mode,
  data_type,
  parameter_default
FROM information_schema.parameters 
WHERE specific_name = 'gallery_items_normal_postgis'
AND parameter_schema = 'public'
ORDER BY ordinal_position;

-- 3. Test the function with minimal parameters
SELECT * FROM gallery_items_normal_postgis(0, 0, 0, 50, NULL) LIMIT 5;

-- 4. Check if PostGIS extension is available
SELECT * FROM pg_extension WHERE extname = 'postgis';

-- 5. Check if items table has data
SELECT COUNT(*) as total_items FROM items WHERE path_512 IS NOT NULL AND gallery = true;

-- 6. Check if items have GPS data
SELECT COUNT(*) as items_with_gps FROM items WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL AND gallery = true; 