-- Function to get all public items for sitemap
CREATE OR REPLACE FUNCTION get_all_public_items_for_sitemap()
RETURNS TABLE (
  slug TEXT,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.slug,
    i.updated_at
  FROM items i
  WHERE i.slug IS NOT NULL
    AND (i.is_private = false OR i.is_private IS NULL)
  ORDER BY i.updated_at DESC;
END;
$$; 