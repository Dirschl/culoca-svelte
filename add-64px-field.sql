-- Add 64px thumbnail field to items table
-- This script adds a path_64 column for 64px thumbnails

-- Add path_64 column
ALTER TABLE items ADD COLUMN IF NOT EXISTS path_64 TEXT;

-- Add comment for the new column
COMMENT ON COLUMN items.path_64 IS 'Path to 64px thumbnail in storage (for map markers)'; 