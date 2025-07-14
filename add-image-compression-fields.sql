-- Add image compression fields to items table
-- This script adds fields to track image compression settings

-- Add image_format column
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_format TEXT DEFAULT 'jpg';

-- Add comment for the new column
COMMENT ON COLUMN items.image_format IS 'Format of the uploaded image: jpg or webp'; 