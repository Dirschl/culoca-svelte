-- Update existing is_private field data based on profile privacy_mode
-- Run this in Supabase SQL Editor (safe to run multiple times)

-- Step 1: Create index if it doesn't exist (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_items_is_private ON items(is_private);

-- Step 2: Update existing data based on profile privacy_mode
-- Set is_private = TRUE for items from profiles with privacy_mode = 'private'
UPDATE items 
SET is_private = CASE 
    WHEN p.privacy_mode = 'private' THEN TRUE 
    ELSE FALSE 
END
FROM profiles p 
WHERE items.profile_id = p.id;

-- Step 3: Set is_private = FALSE for items without profile (safety)
UPDATE items 
SET is_private = FALSE 
WHERE profile_id IS NULL OR is_private IS NULL;

-- Step 4: Verify the migration
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN is_private = TRUE THEN 1 END) as private_items,
    COUNT(CASE WHEN is_private = FALSE THEN 1 END) as public_items,
    COUNT(CASE WHEN is_private IS NULL THEN 1 END) as null_items
FROM items;

-- Step 5: Check some examples
SELECT 
    i.id,
    i.title,
    i.profile_id,
    i.is_private,
    p.privacy_mode
FROM items i
LEFT JOIN profiles p ON i.profile_id = p.id
LIMIT 10; 