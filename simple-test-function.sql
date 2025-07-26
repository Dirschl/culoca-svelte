-- Simple test to check if the function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'items_by_distance_unified';

-- Test the function directly
SELECT * FROM public.items_by_distance_unified(
  current_user_id := NULL,
  filter_user_id := NULL,
  page := 0,
  page_size := 3,
  require_gallery := true,
  search := NULL,
  user_lat := NULL,
  user_lon := NULL
); 