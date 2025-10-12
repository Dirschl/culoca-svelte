-- Create function to get random items for homepage featured section
-- This function uses ORDER BY RANDOM() for true randomness across the entire database

CREATE OR REPLACE FUNCTION get_random_items(item_limit INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  path_2048_og TEXT,
  width INTEGER,
  height INTEGER
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
    i.description,
    i.path_2048_og,
    i.width,
    i.height
  FROM items i
  WHERE i.slug IS NOT NULL
    AND i.path_2048_og IS NOT NULL
    AND i.is_private = false
  ORDER BY RANDOM()
  LIMIT item_limit;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_random_items(INTEGER) TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION get_random_items IS 'Returns random public items for homepage featured section. Uses ORDER BY RANDOM() for true randomness.';

