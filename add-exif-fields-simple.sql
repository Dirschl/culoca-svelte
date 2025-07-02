-- Add EXIF fields to images table (simple version)
ALTER TABLE images ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS keywords TEXT; 