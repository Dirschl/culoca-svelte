-- Add is_private field to items table for denormalized privacy filtering
-- This eliminates the need for JOINs with profiles table for performance

-- Step 1: Add the new field
ALTER TABLE items ADD COLUMN is_private BOOLEAN DEFAULT FALSE NOT NULL;

-- Step 2: Create index for performance
CREATE INDEX idx_items_is_private ON items(is_private);

-- Step 3: Populate existing data based on profile privacy_mode
-- Set is_private = TRUE for items from profiles with privacy_mode = 'private'
UPDATE items 
SET is_private = CASE 
    WHEN p.privacy_mode = 'private' THEN TRUE 
    ELSE FALSE 
END
FROM profiles p 
WHERE items.profile_id = p.id;

-- Step 4: Set is_private = FALSE for items without profile (safety)
UPDATE items 
SET is_private = FALSE 
WHERE profile_id IS NULL;

-- Verify the migration
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN is_private = TRUE THEN 1 END) as private_items,
    COUNT(CASE WHEN is_private = FALSE THEN 1 END) as public_items
FROM items; 