-- Add show_image_captions field to profiles table
-- This field controls whether image captions (title links) are shown below images in galleries

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS show_image_captions BOOLEAN DEFAULT true;

-- Update existing users to show captions by default
UPDATE profiles 
SET show_image_captions = true 
WHERE show_image_captions IS NULL;

-- Add comment
COMMENT ON COLUMN profiles.show_image_captions IS 'Show image titles as links below images in galleries';

