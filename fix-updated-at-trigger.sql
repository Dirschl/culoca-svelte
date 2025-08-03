-- Fix updated_at trigger for items table
-- Run this in Supabase SQL Editor

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 2: Create the trigger on items table
DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 3: Update all existing items to have updated_at = created_at
UPDATE items 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Step 4: Verify the trigger is working
SELECT 
    COUNT(*) as total_items,
    COUNT(updated_at) as items_with_updated_at,
    COUNT(*) - COUNT(updated_at) as items_without_updated_at
FROM items;

-- Step 5: Test the trigger by updating a sample item
UPDATE items 
SET title = title 
WHERE id = (SELECT id FROM items LIMIT 1);

-- Step 6: Check if updated_at was updated
SELECT id, title, created_at, updated_at 
FROM items 
ORDER BY updated_at DESC 
LIMIT 5; 