-- Check current function definition
-- Execute this in Supabase SQL Editor

-- Show the current function definition
SELECT 
  routine_name, 
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'gallery_items_normal_postgis'
AND routine_schema = 'public';

-- Show function parameters
SELECT 
  parameter_name,
  parameter_mode,
  data_type,
  parameter_default
FROM information_schema.parameters 
WHERE specific_name = 'gallery_items_normal_postgis'
AND parameter_schema = 'public'
ORDER BY ordinal_position;

-- Test the function with sample data
SELECT 
  id,
  title,
  distance,
  lat,
  lon,
  profile_id
FROM gallery_items_normal_postgis(48.319342861127, 12.718476419138664, 0, 5, 'aae40790-a31e-4c21-a03b-762f513f52af')
LIMIT 3; 