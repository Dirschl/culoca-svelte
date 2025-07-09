-- Add title and description fields to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_title ON items(title);
CREATE INDEX IF NOT EXISTS idx_items_description ON items(description); 