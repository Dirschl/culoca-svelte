-- Update get_images_by_distance_simple function with latest version from Supabase backup
-- This function provides simple distance-based image loading

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_images_by_distance_simple(double precision, double precision);

-- Create updated function
CREATE OR REPLACE FUNCTION public.get_images_by_distance_simple(
  filter_lat double precision,
  filter_lon double precision
) RETURNS TABLE(
  id text,
  path_512 text,
  path_2048 text,
  path_64 text,
  width integer,
  height integer,
  lat double precision,
  lon double precision,
  title text,
  description text,
  distance double precision
)
LANGUAGE plpgsql
AS $$
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
    -- Haversine formula for distance calculation in meters
    (6371000 * acos(
      cos(radians(filter_lat)) * 
      cos(radians(i.lat)) * 
      cos(radians(i.lon) - radians(filter_lon)) + 
      sin(radians(filter_lat)) * 
      sin(radians(i.lat))
    )) as distance
  FROM items i
  WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL
    AND i.path_512 IS NOT NULL
  ORDER BY distance ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_images_by_distance_simple(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_images_by_distance_simple(double precision, double precision) TO anon;

-- Test the function
SELECT 'get_images_by_distance_simple updated successfully' as status; 