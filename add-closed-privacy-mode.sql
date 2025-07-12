-- Add 'closed' privacy mode to profiles table constraint
-- Run this in Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_privacy_mode_check;

-- Then add the new constraint that includes 'closed'
ALTER TABLE profiles 
ADD CONSTRAINT profiles_privacy_mode_check 
CHECK (privacy_mode IN ('public', 'closed', 'private', 'all'));

-- Note: The privacy_mode field now supports 'closed' mode
-- public: filter removable, closed: filter locked, private: redirect, all: no filter

-- Verify the constraint
SELECT 
    privacy_mode,
    COUNT(*) as count
FROM profiles 
GROUP BY privacy_mode
ORDER BY privacy_mode; 