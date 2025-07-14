-- Drop the existing function first to handle return type changes
DROP FUNCTION IF EXISTS images_by_distance_optimized(double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS images_by_distance_optimized(double precision, double precision, integer, integer, integer);

CREATE OR REPLACE FUNCTION images_by_distance_optimized(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  max_radius_meters INTEGER DEFAULT 5000,
  max_results INTEGER DEFAULT 2000,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  title CHARACTER VARYING,
  description CHARACTER VARYING,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  path_2048 TEXT,
  path_512 TEXT,
  path_64 TEXT,
  original_url TEXT,
  width INTEGER,
  height INTEGER,
  original_name TEXT,
  profile_id UUID,
  exif_data JSONB,
  image_format TEXT,
  distance_meters DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    i.id,
    i.created_at,
    i.title,
    i.description,
    i.lat,
    i.lon,
    i.path_2048,
    i.path_512,
    i.path_64,
    i.original_url,
    i.width,
    i.height,
    i.original_name,
    i.profile_id,
    i.exif_data,
    i.image_format,
    -- Haversine formula for distance calculation in meters
    (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(i.lat)) * 
      cos(radians(i.lon) - radians(user_lon)) + 
      sin(radians(user_lat)) * 
      sin(radians(i.lat))
    )) as distance_meters
  FROM items i
  WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL
    AND i.path_512 IS NOT NULL  -- Only return items with processed 512px images
    AND i.path_2048 IS NOT NULL  -- Only return items with processed 2048px images
    -- No bounding box filter - rely only on accurate Haversine distance calculation
  ORDER BY distance_meters ASC
  LIMIT max_results
  OFFSET offset_count;
$$; 