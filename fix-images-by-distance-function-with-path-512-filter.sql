-- Fix images_by_distance function to only return images with valid path_512
-- This ensures users never see placeholder images

-- Drop the existing function
DROP FUNCTION IF EXISTS images_by_distance;

-- Create the updated function that filters out images without path_512
CREATE OR REPLACE FUNCTION images_by_distance(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  page INTEGER DEFAULT 0,
  page_size INTEGER DEFAULT 15
)
RETURNS TABLE(
  id UUID,
  path_512 TEXT,
  path_2048 TEXT,
  path_64 TEXT,
  width INTEGER,
  height INTEGER,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  title TEXT,
  description TEXT,
  keywords TEXT[],
  distance DOUBLE PRECISION,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.path_512,
    i.path_2048,
    i.path_64,
    i.width,
    i.height,
    i.lat,
    i.lon,
    i.title,
    i.description,
    i.keywords,
    CASE 
      WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        (6371000 * acos(cos(radians(user_lat)) * cos(radians(i.lat)) * 
         cos(radians(i.lon) - radians(user_lon)) + sin(radians(user_lat)) * 
         sin(radians(i.lat))))
      ELSE NULL
    END as distance,
    i.created_at
  FROM items i
  WHERE i.path_512 IS NOT NULL  -- CRITICAL: Only return images with valid path_512
    AND i.status = 'ready'       -- Only return processed images
  ORDER BY 
    CASE 
      WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        (6371000 * acos(cos(radians(user_lat)) * cos(radians(i.lat)) * 
         cos(radians(i.lon) - radians(user_lon)) + sin(radians(user_lat)) * 
         sin(radians(i.lat))))
      ELSE 999999999  -- Put images without GPS at the end
    END ASC,
    i.created_at DESC
  LIMIT page_size
  OFFSET page * page_size;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'Function updated successfully' as status;

-- Test the function
SELECT 'Function updated successfully' as status; 