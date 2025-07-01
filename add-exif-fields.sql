-- Add EXIF fields to images table
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_images_title ON images(title);
CREATE INDEX IF NOT EXISTS idx_images_keywords ON images(keywords);
CREATE INDEX IF NOT EXISTS idx_images_lat_lon ON images(lat, lon); 