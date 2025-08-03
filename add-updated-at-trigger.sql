-- Add updated_at trigger to automatically update timestamp on item changes
-- This ensures updated_at is always current when items are modified

-- First, let's check if the trigger function already exists
DO $$
BEGIN
    -- Create the trigger function if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    END IF;
END $$;

-- Create the trigger on the items table
DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update all existing items to have updated_at = created_at
UPDATE items 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Verify the trigger is working
SELECT 
    COUNT(*) as total_items,
    COUNT(updated_at) as items_with_updated_at,
    COUNT(*) - COUNT(updated_at) as items_without_updated_at
FROM items; 