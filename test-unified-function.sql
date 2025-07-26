-- Test the unified function directly
SELECT 
  function_name,
  parameter_name,
  parameter_mode,
  data_type,
  parameter_default
FROM information_schema.parameters 
WHERE function_name = 'items_by_distance_unified'
ORDER BY ordinal_position;

-- Test the function with minimal parameters
SELECT * FROM public.items_by_distance_unified(
  current_user_id := NULL,
  filter_user_id := NULL,
  page := 0,
  page_size := 5,
  require_gallery := true,
  search := NULL,
  user_lat := NULL,
  user_lon := NULL
) LIMIT 3; 