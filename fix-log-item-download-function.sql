-- Fix log_item_download function to work with RLS
-- This script recreates the function with proper security settings

-- Drop existing function
DROP FUNCTION IF EXISTS log_item_download(UUID, UUID, VARCHAR, VARCHAR);

-- Recreate function with SECURITY DEFINER and proper permissions
CREATE OR REPLACE FUNCTION log_item_download(
  p_item_id UUID,
  p_user_id UUID,
  p_download_type VARCHAR(20),
  p_download_source VARCHAR(20)
)
RETURNS UUID AS $$
DECLARE
  download_id UUID;
BEGIN
  -- Insert with SECURITY DEFINER bypasses RLS
  INSERT INTO item_downloads (item_id, user_id, download_type, download_source)
  VALUES (p_item_id, p_user_id, p_download_type, p_download_source)
  RETURNING id INTO download_id;
  
  RETURN download_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION log_item_download(UUID, UUID, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION log_item_download(UUID, UUID, VARCHAR, VARCHAR) TO anon;

-- Test the function
SELECT 'log_item_download function fixed successfully!' as status;




