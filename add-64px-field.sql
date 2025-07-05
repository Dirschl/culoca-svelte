-- Add path_64 field to images table for 64px thumbnails
ALTER TABLE images ADD COLUMN IF NOT EXISTS path_64 TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_images_path_64 ON images(path_64);

-- Add comment to document the new field
COMMENT ON COLUMN images.path_64 IS 'Path to 64px thumbnail in storage (for map markers)'; 