-- Install map functions with pagination support
-- This script will create functions that support pagination to return more than 1000 images

-- 1. Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT);
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS map_images_postgis_simple(DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP FUNCTION IF EXISTS map_images_postgis_simple(DOUBLE PRECISION, DOUBLE PRECISION, TEXT);

-- 2. Create the main map_images_postgis function with pagination support
CREATE OR REPLACE FUNCTION map_images_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  current_user_id TEXT DEFAULT NULL,
  user_filter_id TEXT DEFAULT NULL,
  location_filter_lat DOUBLE PRECISION DEFAULT NULL,
  location_filter_lon DOUBLE PRECISION DEFAULT NULL,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  path_64 TEXT,
  title CHARACTER VARYING(255),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  distance DOUBLE PRECISION,
  is_private BOOLEAN,
  profile_id UUID
)
AS $$
DECLARE
  user_uuid UUID;
  filter_user_uuid UUID;
  effective_lat DOUBLE PRECISION;
  effective_lon DOUBLE PRECISION;
  offset_value INTEGER;
BEGIN
  -- Convert TEXT to UUID if provided
  IF current_user_id IS NOT NULL AND current_user_id != '' THEN
    user_uuid := current_user_id::UUID;
  ELSE
    user_uuid := NULL;
  END IF;

  -- Convert user_filter_id to UUID if provided
  IF user_filter_id IS NOT NULL AND user_filter_id != '' THEN
    filter_user_uuid := user_filter_id::UUID;
  ELSE
    filter_user_uuid := NULL;
  END IF;

  -- Determine effective coordinates (location filter overrides user position)
  IF location_filter_lat IS NOT NULL AND location_filter_lon IS NOT NULL THEN
    effective_lat := location_filter_lat;
    effective_lon := location_filter_lon;
  ELSE
    effective_lat := user_lat;
    effective_lon := user_lon;
  END IF;

  -- Calculate offset for pagination
  offset_value := page_value * page_size_value;

  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.path_64,
    i.title,
    i.lat,
    i.lon,
    CASE
      WHEN effective_lat != 0 AND effective_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        ST_Distance(
          ST_MakePoint(effective_lon, effective_lat)::geography,
          ST_MakePoint(i.lon, i.lat)::geography
        )
      ELSE
        999999999
    END AS distance,
    i.is_private,
    i.profile_id
  FROM items i
  WHERE i.path_512 IS NOT NULL
    AND i.gallery = true
    AND i.lat IS NOT NULL
    AND i.lon IS NOT NULL
    AND i.path_64 IS NOT NULL
    AND (
      -- User filter is active: show all images from that user (including private)
      (filter_user_uuid IS NOT NULL AND i.profile_id = filter_user_uuid)
      OR
      -- No user filter: apply privacy filtering based on current user
      (filter_user_uuid IS NULL AND (
        (user_uuid IS NOT NULL AND (i.profile_id = user_uuid OR i.is_private = false OR i.is_private IS NULL))
        OR
        (user_uuid IS NULL AND (i.is_private = false OR i.is_private IS NULL))
      ))
    )
  ORDER BY distance ASC
  LIMIT page_size_value
  OFFSET offset_value;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the simple fallback function with pagination support
CREATE OR REPLACE FUNCTION map_images_postgis_simple(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  current_user_id TEXT DEFAULT NULL,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  path_64 TEXT,
  title CHARACTER VARYING(255),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  distance DOUBLE PRECISION
)
AS $$
DECLARE
  offset_value INTEGER;
BEGIN
  -- Calculate offset for pagination
  offset_value := page_value * page_size_value;

  RETURN QUERY
  SELECT 
    i.id,
    i.slug,
    i.path_64,
    i.title,
    i.lat,
    i.lon,
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        ST_Distance(
          ST_MakePoint(user_lon, user_lat)::geography,
          ST_MakePoint(i.lon, i.lat)::geography
        )
      ELSE
        999999999
    END AS distance
  FROM items i
  WHERE i.gallery = true
    AND i.lat IS NOT NULL
    AND i.lon IS NOT NULL
    AND i.path_64 IS NOT NULL
    AND (i.is_private = false OR i.is_private IS NULL)
  ORDER BY distance ASC
  LIMIT page_size_value
  OFFSET offset_value;
END;
$$ LANGUAGE plpgsql;

-- 4. Test the functions with pagination
SELECT 'Testing map_images_postgis with pagination...' as test;
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, NULL, NULL, NULL, NULL, 0, 1000);
SELECT COUNT(*) as page_1_images FROM map_images_postgis(0, 0, NULL, NULL, NULL, NULL, 0, 1000);
SELECT COUNT(*) as page_2_images FROM map_images_postgis(0, 0, NULL, NULL, NULL, NULL, 1, 1000);

SELECT 'Testing map_images_postgis_simple with pagination...' as test;
SELECT COUNT(*) as total_images FROM map_images_postgis_simple(0, 0, NULL, 0, 1000);
SELECT COUNT(*) as page_1_images FROM map_images_postgis_simple(0, 0, NULL, 0, 1000);
SELECT COUNT(*) as page_2_images FROM map_images_postgis_simple(0, 0, NULL, 1, 1000);

-- 5. Show function status
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines 
WHERE routine_name IN ('map_images_postgis', 'map_images_postgis_simple')
  AND routine_schema = 'public'
ORDER BY routine_name; 