-- Add type_id field to items table
-- This field will help categorize different types of content using numeric IDs
-- 1 = Photo, 2 = Event, 3 = Link, 4 = Text, 5 = Company, 6 = Video

-- Add the type_id column with default value
ALTER TABLE items ADD COLUMN type_id INTEGER DEFAULT 1 NOT NULL;

-- Add constraint to ensure only valid type IDs are used
ALTER TABLE items ADD CONSTRAINT check_item_type_id 
CHECK (type_id IN (1, 2, 3, 4, 5, 6));

-- Create index for better query performance
CREATE INDEX idx_items_type_id ON items(type_id);

-- Update existing items to have type_id = 1 (photos)
UPDATE items SET type_id = 1 WHERE type_id IS NULL OR type_id = 0;

-- Add comment to document the field
COMMENT ON COLUMN items.type_id IS 'Type of item: 1=Photo, 2=Event, 3=Link, 4=Text, 5=Company, 6=Video'; 