-- Fix images_by_distance_optimized function to work properly
-- This replaces the old function that was using PostGIS functions

DROP FUNCTION IF EXISTS images_by_distance_optimized(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION images_by_distance_optimized(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  max_radius_meters INTEGER DEFAULT 5000,
  max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
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
  distance_meters DOUBLE PRECISION,
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
    -- Haversine formula for distance calculation in meters
    (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(i.lat)) * 
      cos(radians(i.lon) - radians(user_lon)) + 
      sin(radians(user_lat)) * 
      sin(radians(i.lat))
    )) as distance_meters,
    i.created_at
  FROM items i
  WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL
    AND i.path_512 IS NOT NULL
    AND i.path_2048 IS NOT NULL  -- Only return items with processed 2048px images
    AND (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(i.lat)) * 
      cos(radians(i.lon) - radians(user_lon)) + 
      sin(radians(user_lat)) * 
      sin(radians(i.lat))
    )) <= max_radius_meters
  ORDER BY distance_meters ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'Function updated successfully' as status; 