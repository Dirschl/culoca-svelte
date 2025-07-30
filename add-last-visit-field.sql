-- Add last_visit field to map_shares table
ALTER TABLE map_shares 
ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have a last_visit timestamp
UPDATE map_shares 
SET last_visit = created_at 
WHERE last_visit IS NULL;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_map_shares_last_visit ON map_shares(last_visit);

-- Optional: Create a function to clean up old shares (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_map_shares()
RETURNS void AS $$
BEGIN
  DELETE FROM map_shares 
  WHERE last_visit < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql; 