-- Install all admin functions manually in Supabase SQL editor
-- Copy and paste this into your Supabase SQL editor

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

-- Create a function to get total items count
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

-- Create a function to search all items
CREATE OR REPLACE FUNCTION search_all_items(
  search_query TEXT DEFAULT '',
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
  WHERE 
    search_query = '' OR
    LOWER(i.title) LIKE '%' || LOWER(search_query) || '%' OR
    LOWER(i.slug) LIKE '%' || LOWER(search_query) || '%' OR
    LOWER(p.accountname) LIKE '%' || LOWER(search_query) || '%'
  ORDER BY i.created_at DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_all_items(TEXT, INTEGER, INTEGER) TO authenticated;

-- Create a function to get search count
CREATE OR REPLACE FUNCTION get_search_count(search_query TEXT DEFAULT '')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM items i
  LEFT JOIN profiles p ON i.user_id = p.id
  WHERE 
    search_query = '' OR
    LOWER(i.title) LIKE '%' || LOWER(search_query) || '%' OR
    LOWER(i.slug) LIKE '%' || LOWER(search_query) || '%' OR
    LOWER(p.accountname) LIKE '%' || LOWER(search_query) || '%';
  RETURN total_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_search_count(TEXT) TO authenticated;

-- Test the functions
SELECT 'All admin functions installed successfully' as status;
SELECT COUNT(*) as total_items FROM items;
SELECT 'Functions available:' as info;
SELECT 'get_all_items_paginated' as function_name;
SELECT 'get_items_count' as function_name;
SELECT 'search_all_items' as function_name;
SELECT 'get_search_count' as function_name; 