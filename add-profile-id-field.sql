-- Add profile_id (creator) to images table if it does not exist
ALTER TABLE images
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_images_profile ON images(profile_id); 