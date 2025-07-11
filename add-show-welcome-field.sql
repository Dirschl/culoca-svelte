-- Add show_welcome field to profiles table
-- This field controls whether the welcome section is shown to users

ALTER TABLE profiles 
ADD COLUMN show_welcome BOOLEAN DEFAULT true;

-- Update existing profiles to show welcome by default
UPDATE profiles 
SET show_welcome = true 
WHERE show_welcome IS NULL;

-- Add comment to document the field
COMMENT ON COLUMN profiles.show_welcome IS 'Controls whether the welcome section is displayed to the user (default: true)'; 