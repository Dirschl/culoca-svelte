-- Install analytics function to get all item_views without limits
-- Run this in your Supabase SQL editor

CREATE OR REPLACE FUNCTION get_all_item_views()
RETURNS TABLE (
  created_at TIMESTAMPTZ,
  visitor_id UUID,
  distance_meters INTEGER,
  user_agent TEXT,
  referer TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    iv.created_at,
    iv.visitor_id,
    iv.distance_meters,
    iv.user_agent,
    iv.referer
  FROM item_views iv
  ORDER BY iv.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_item_views() TO authenticated;

-- Test the function
SELECT COUNT(*) FROM get_all_item_views(); 