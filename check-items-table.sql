-- Check the actual structure of the items table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'items' 
ORDER BY ordinal_position;

-- Check total count of all items
SELECT COUNT(*) as total_items FROM items;

-- Check count with GPS coordinates
SELECT COUNT(*) as items_with_gps FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Check count with path_512 (what the gallery actually shows)
SELECT COUNT(*) as items_with_path_512 FROM items 
WHERE path_512 IS NOT NULL;

-- Check count with both GPS and path_512
SELECT COUNT(*) as items_with_gps_and_path_512 FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL;

-- Check count with both GPS and path_2048
SELECT COUNT(*) as items_with_gps_and_path_2048 FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_2048 IS NOT NULL;

-- Check count with GPS, path_512 AND path_2048 (what the optimized function returns)
SELECT COUNT(*) as items_with_gps_and_both_paths FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL AND path_2048 IS NOT NULL;

-- Show the missing images (have GPS and path_512 but no path_2048)
SELECT COUNT(*) as missing_path_2048_count FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL AND path_2048 IS NULL;

-- Show examples of the missing images
SELECT id, original_name, path_512, path_2048, status, error_message
FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL AND path_512 IS NOT NULL AND path_2048 IS NULL
LIMIT 10;

-- Check status field distribution
SELECT status, COUNT(*) as count FROM items GROUP BY status;

-- Check the exact same query the optimized function uses
SELECT COUNT(*) as optimized_function_count FROM items
WHERE lat IS NOT NULL 
  AND lon IS NOT NULL; 