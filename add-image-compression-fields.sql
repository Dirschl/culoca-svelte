-- Add image compression fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS image_format TEXT DEFAULT 'jpg',
ADD COLUMN IF NOT EXISTS image_quality INTEGER DEFAULT 85;

-- Add image format field to images table
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS image_format TEXT DEFAULT 'jpg';

-- Add comment to explain the fields
COMMENT ON COLUMN profiles.image_format IS 'Image format preference: jpg or webp';
COMMENT ON COLUMN profiles.image_quality IS 'Image quality setting: 35-95';
COMMENT ON COLUMN images.image_format IS 'Format of the uploaded image: jpg or webp'; 