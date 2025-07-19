-- Update items_search_view to include gallery field
DROP VIEW IF EXISTS items_search_view;

CREATE VIEW items_search_view AS
SELECT 
  id,
  title,
  description,
  keywords,
  lat,
  lon,
  path_512,
  path_2048,
  path_64,
  width,
  height,
  created_at,
  user_id,
  profile_id,
  is_private,
  gallery,
  -- Combine title, description, and keywords for full-text search
  COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(keywords, '') AS search_text
FROM items
WHERE path_512 IS NOT NULL;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_items_search_text ON items USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(keywords, '')));

-- Grant permissions
GRANT SELECT ON items_search_view TO authenticated;
GRANT SELECT ON items_search_view TO anon; 