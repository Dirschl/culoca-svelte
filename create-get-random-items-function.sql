-- Create function to get random items for homepage featured section
-- This function uses ORDER BY RANDOM() for true randomness across the entire database

-- Funktion zum Abrufen zufälliger Items für die Welcome Section
-- Die og:image wird über /api/og-image/[slug] generiert, daher brauchen wir keine Pfade
CREATE OR REPLACE FUNCTION get_random_items(item_limit INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.slug,
    i.title,
    i.description
  FROM items i
  WHERE i.slug IS NOT NULL
    AND i.is_private = false
  ORDER BY RANDOM()
  LIMIT item_limit;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_random_items(INTEGER) TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION get_random_items IS 'Returns random public items for homepage featured section. Uses ORDER BY RANDOM() for true randomness.';

