-- Create a function to get all items with pagination
CREATE OR REPLACE FUNCTION get_all_items_paginated(
  page_offset INTEGER DEFAULT 0,
  page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  created_at TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  is_private BOOLEAN,
  user_id UUID,
  width INTEGER,
  height INTEGER,
  path_512 TEXT,
  accountname TEXT,
  full_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.title,
    i.slug,
    i.created_at,
    i.lat,
    i.lon,
    i.is_private,
    i.user_id,
    i.width,
    i.height,
    i.path_512,
    p.accountname,
    p.full_name
  FROM items i
  LEFT JOIN profiles p ON i.user_id = p.id
  ORDER BY i.created_at DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_items_paginated(INTEGER, INTEGER) TO authenticated;

-- Create a function to get total count of items
CREATE OR REPLACE FUNCTION get_items_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM items;
  RETURN total_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_items_count() TO authenticated; 