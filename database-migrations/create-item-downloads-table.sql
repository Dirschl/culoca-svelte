-- Create item_downloads table for tracking downloads
-- This migration creates a table to track all downloads for analytics
-- Führe dieses Script im Supabase Dashboard aus

-- Create item_downloads table
CREATE TABLE IF NOT EXISTS item_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  download_type VARCHAR(20) NOT NULL CHECK (download_type IN ('preview', 'full_resolution', 'purchased')),
  download_source VARCHAR(20) NOT NULL CHECK (download_source IN ('rights', 'purchase', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_downloads_item_id ON item_downloads(item_id);
CREATE INDEX IF NOT EXISTS idx_item_downloads_user_id ON item_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_item_downloads_created_at ON item_downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_item_downloads_type ON item_downloads(download_type);
CREATE INDEX IF NOT EXISTS idx_item_downloads_item_user ON item_downloads(item_id, user_id);

-- Enable RLS
ALTER TABLE item_downloads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own downloads" ON item_downloads;
CREATE POLICY "Users can view their own downloads" ON item_downloads
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Item owners can view downloads of their items" ON item_downloads;
CREATE POLICY "Item owners can view downloads of their items" ON item_downloads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = item_downloads.item_id 
      AND items.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert downloads" ON item_downloads;
CREATE POLICY "System can insert downloads" ON item_downloads
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON item_downloads TO authenticated;
GRANT SELECT ON item_downloads TO anon;

-- Create function to log downloads
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
  INSERT INTO item_downloads (item_id, user_id, download_type, download_source)
  VALUES (p_item_id, p_user_id, p_download_type, p_download_source)
  RETURNING id INTO download_id;
  
  RETURN download_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get unique download statistics
CREATE OR REPLACE FUNCTION get_item_download_stats(p_item_id UUID DEFAULT NULL)
RETURNS TABLE (
  item_id UUID,
  total_downloads BIGINT,
  unique_downloaders BIGINT,
  full_resolution_downloads BIGINT,
  unique_full_res_downloaders BIGINT,
  preview_downloads BIGINT,
  unique_preview_downloaders BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p_item_id, id.item_id) as item_id,
    COUNT(*) as total_downloads,
    COUNT(DISTINCT id.user_id) as unique_downloaders,
    COUNT(CASE WHEN id.download_type = 'full_resolution' THEN 1 END) as full_resolution_downloads,
    COUNT(DISTINCT CASE WHEN id.download_type = 'full_resolution' THEN id.user_id END) as unique_full_res_downloaders,
    COUNT(CASE WHEN id.download_type = 'preview' THEN 1 END) as preview_downloads,
    COUNT(DISTINCT CASE WHEN id.download_type = 'preview' THEN id.user_id END) as unique_preview_downloaders
  FROM item_downloads id
  WHERE p_item_id IS NULL OR id.item_id = p_item_id
  GROUP BY COALESCE(p_item_id, id.item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirmation
SELECT 'Item downloads tracking system created successfully!' as status;
