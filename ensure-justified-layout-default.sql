-- Ensure all existing users have use_justified_layout set to true
-- Run this in Supabase SQL Editor

-- Update existing profiles that have NULL use_justified_layout to true
UPDATE profiles 
SET use_justified_layout = true 
WHERE use_justified_layout IS NULL;

-- Verify the update
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN use_justified_layout = true THEN 1 END) as justified_layout_count,
    COUNT(CASE WHEN use_justified_layout = false THEN 1 END) as grid_layout_count,
    COUNT(CASE WHEN use_justified_layout IS NULL THEN 1 END) as null_count
FROM profiles; 