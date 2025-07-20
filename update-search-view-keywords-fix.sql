-- Fix items_search_view to properly handle keywords array
-- This ensures keywords are properly converted from array to string for search

-- Drop and recreate the view with proper keywords handling
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
  -- FIX: Handle keywords as array using array_to_string
  COALESCE(title, '') || ' ' || 
  COALESCE(description, '') || ' ' || 
  COALESCE(
    CASE 
      WHEN keywords IS NULL THEN ''
      WHEN keywords = '{}' THEN ''
      ELSE array_to_string(keywords, ' ')
    END, ''
  ) AS search_text
FROM items
WHERE path_512 IS NOT NULL;

-- Create GIN index for full-text search with German configuration
DROP INDEX IF EXISTS idx_items_search_text_german;
CREATE INDEX idx_items_search_text_german ON items USING gin(
  to_tsvector('german', 
    COALESCE(title, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(
      CASE 
        WHEN keywords IS NULL THEN ''
        WHEN keywords = '{}' THEN ''
        ELSE array_to_string(keywords, ' ')
      END, ''
    )
  )
);

-- Grant permissions
GRANT SELECT ON items_search_view TO authenticated;
GRANT SELECT ON items_search_view TO anon;

-- Test the fix
SELECT 'View updated successfully' as status;

-- Show some examples of how keywords are now handled
SELECT 
  id, 
  title, 
  keywords,
  array_to_string(keywords, ' ') as keywords_string,
  search_text
FROM items_search_view 
WHERE keywords IS NOT NULL AND keywords != '{}'
LIMIT 5; 