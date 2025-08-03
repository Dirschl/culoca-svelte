-- Update existing items to have type_id = 1 (Foto)
-- This script should be run after adding the type_id column

-- Update all existing items to have type_id = 1 (Foto)
UPDATE items 
SET type_id = 1 
WHERE type_id IS NULL OR type_id = 0;

-- Verify the update
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN type_id = 1 THEN 1 END) as photo_items,
  COUNT(CASE WHEN type_id IS NULL THEN 1 END) as null_type_items
FROM items;

-- Show sample of updated items
SELECT id, title, type_id, created_at 
FROM items 
ORDER BY created_at DESC 
LIMIT 10; 