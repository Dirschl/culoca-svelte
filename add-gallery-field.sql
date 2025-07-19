-- Add gallery field to items table
ALTER TABLE items ADD COLUMN gallery BOOLEAN DEFAULT true;

-- Update existing items to have gallery = true
UPDATE items SET gallery = true WHERE gallery IS NULL;

-- Create index for better performance
CREATE INDEX idx_items_gallery ON items(gallery); 