-- Add privacy_mode field to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN privacy_mode TEXT DEFAULT 'public' CHECK (privacy_mode IN ('public', 'private', 'all'));

-- Add comment to explain the field
COMMENT ON COLUMN profiles.privacy_mode IS 'Permalink behavior: public (filter removable), private (filter locked), all (no filter)';

-- Update existing profiles to have default privacy_mode
UPDATE profiles 
SET privacy_mode = 'public' 
WHERE privacy_mode IS NULL; 