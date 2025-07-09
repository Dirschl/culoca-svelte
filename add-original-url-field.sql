-- Add original_url field to items table for Hetzner Storage Box links
ALTER TABLE items ADD COLUMN IF NOT EXISTS original_url TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_items_original_url ON items(original_url);

-- Add comment to document the new field
COMMENT ON COLUMN items.original_url IS 'URL to original image file on Hetzner Storage Box'; 