-- Simple test script to check if the items_by_distance function works
-- Run this in Supabase SQL editor

-- First, let's check if the function exists
SELECT routine_name, routine_type, data_type 
FROM information_schema.routines 
WHERE routine_name = 'items_by_distance';

-- Check the function parameters
SELECT parameter_name, parameter_mode, data_type, parameter_default
FROM information_schema.parameters 
WHERE specific_name LIKE 'items_by_distance%'
ORDER BY ordinal_position;

-- Test with minimal parameters (only lat/lon)
SELECT COUNT(*) as result_count FROM items_by_distance(52.5200, 13.4050);

-- Test with default parameters
SELECT COUNT(*) as result_count FROM items_by_distance(52.5200, 13.4050, 0, 50, NULL, FALSE, NULL);

-- Test with explicit type casting
SELECT COUNT(*) as result_count FROM items_by_distance(52.5200::DOUBLE PRECISION, 13.4050::DOUBLE PRECISION);

-- Check if we have any public items with GPS coordinates
SELECT COUNT(*) as available_items FROM items 
WHERE lat IS NOT NULL 
AND lon IS NOT NULL 
AND path_512 IS NOT NULL
AND (is_private = false OR is_private IS NULL); 