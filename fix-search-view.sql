-- Fix items_search_view for proper German full-text search
-- This ensures the search functionality works correctly

-- Drop and recreate the view
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

-- Create GIN index for full-text search with German configuration
DROP INDEX IF EXISTS idx_items_search_text_german;
CREATE INDEX idx_items_search_text_german ON items USING gin(to_tsvector('german', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(keywords, '')));

-- Grant permissions
GRANT SELECT ON items_search_view TO authenticated;
GRANT SELECT ON items_search_view TO anon;

-- Test the view
SELECT COUNT(*) as total_items FROM items_search_view;
SELECT COUNT(*) as items_with_search_text FROM items_search_view WHERE search_text != '';

-- Show some examples of search_text content
SELECT id, title, description, keywords, search_text 
FROM items_search_view 
WHERE search_text != '' 
LIMIT 5; 