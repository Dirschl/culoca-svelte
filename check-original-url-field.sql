-- Check if original_url field exists in items table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'items' 
AND column_name = 'original_url';

-- Count how many items have original_url set
SELECT COUNT(*) as items_with_original_url 
FROM items 
WHERE original_url IS NOT NULL;

-- Show a few examples of items with original_url
SELECT id, original_url 
FROM items 
WHERE original_url IS NOT NULL 
LIMIT 5; 