-- Add screenshot_url field to map_shares table
ALTER TABLE map_shares 
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- Drop the old screenshot column if it exists (since we're using URLs now)
ALTER TABLE map_shares 
DROP COLUMN IF EXISTS screenshot;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_map_shares_screenshot_url ON map_shares(screenshot_url); 