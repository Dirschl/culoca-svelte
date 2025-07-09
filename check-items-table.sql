-- Check items table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'items'
ORDER BY ordinal_position;

-- Check if original_url field exists
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'items'
AND column_name = 'original_url';

-- Count items with original_url
SELECT 
    COUNT(*) as total_items,
    COUNT(original_url) as items_with_original_url,
    COUNT(*) - COUNT(original_url) as items_without_original_url
FROM items; 