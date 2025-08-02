-- =====================================================
-- FIX NEWSPLASH SORTING - DEDICATED FUNCTION
-- =====================================================

-- This creates a dedicated function for NewsFlash that sorts by created_at DESC
-- instead of using the distance-based gallery_items_normal_postgis function

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.newsflash_items_postgis(
  page_value integer,
  page_size_value integer,
  current_user_id uuid,
  mode text
);

CREATE OR REPLACE FUNCTION public.newsflash_items_postgis(
  page_value integer DEFAULT 0,
  page_size_value integer DEFAULT 50,
  current_user_id uuid DEFAULT NULL,
  mode text DEFAULT 'alle'
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  lat double precision,
  lon double precision,
  path_512 text,
  path_2048 text,
  path_64 text,
  width integer,
  height integer,
  original_name text,
  profile_id uuid,
  is_private boolean,
  created_at timestamptz,
  accountname text,
  full_name text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.slug,
    i.title::text,
    i.description::text,
    i.lat,
    i.lon,
    i.path_512,
    i.path_2048,
    i.path_64,
    i.width,
    i.height,
    i.original_name,
    i.profile_id,
    i.is_private,
    i.created_at,
    p.accountname,
    p.full_name,
    COUNT(*) OVER() AS total_count
  FROM items i
  LEFT JOIN profiles p ON p.id = i.profile_id
  WHERE 
    i.path_512 IS NOT NULL
    AND i.gallery = true
    AND (
      -- Privacy filtering based on mode and user
      CASE 
        WHEN current_user_id IS NOT NULL AND mode = 'eigene' THEN
          i.profile_id = current_user_id
        WHEN current_user_id IS NOT NULL AND mode = 'alle' THEN
          i.profile_id = current_user_id OR i.is_private = false OR i.is_private IS NULL
        WHEN mode = 'aus' THEN
          i.is_private = false OR i.is_private IS NULL
        ELSE
          -- Anonymous users or default: only public images
          i.is_private = false OR i.is_private IS NULL
      END
    )
  ORDER BY i.created_at DESC  -- NEUESTE ZUERST - für NewsFlash!
  LIMIT page_size_value
  OFFSET (page_value * page_size_value);
END;
$$;

-- Create index for optimal performance
CREATE INDEX IF NOT EXISTS idx_newsflash_created_at 
ON items (created_at DESC, gallery, path_512) 
WHERE gallery = true AND path_512 IS NOT NULL;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.newsflash_items_postgis TO authenticated;
GRANT EXECUTE ON FUNCTION public.newsflash_items_postgis TO anon;

-- Test the function
-- SELECT * FROM newsflash_items_postgis(0, 10, NULL, 'alle'); 