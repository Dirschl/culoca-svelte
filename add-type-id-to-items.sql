-- Add type_id field to items table and link to types table
-- This creates a proper foreign key relationship for item categorization

-- Add the type_id column with default value (1 = Foto)
ALTER TABLE items ADD COLUMN type_id INTEGER DEFAULT 1 NOT NULL;

-- Add foreign key constraint to link to types table
ALTER TABLE items ADD CONSTRAINT fk_items_type_id 
FOREIGN KEY (type_id) REFERENCES types(id);

-- Create index for better query performance
CREATE INDEX idx_items_type_id ON items(type_id);

-- Update existing items to have type_id = 1 (Foto)
UPDATE items SET type_id = 1 WHERE type_id IS NULL OR type_id = 0;

-- Add comment to document the field
COMMENT ON COLUMN items.type_id IS 'Foreign key reference to types table (1=Foto, 2=Event, etc.)'; 