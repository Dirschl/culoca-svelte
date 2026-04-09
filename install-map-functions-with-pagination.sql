-- Install map functions with pagination support
-- This script will create functions that support pagination to return more than 1000 images

-- 1. Drop existing functions to avoid conflicts
-- WICHTIG: Bei geändertem RETURNS TABLE reicht CREATE OR REPLACE nicht – die Variante mit
-- exakt gleicher Argumentliste muss vorher per DROP entfernt werden (Fehler 42P13).
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS map_images_postgis_simple(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, INTEGER);
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

-- 3. Simple-Funktion (Pagination): oben bereits per DROP entfernt falls vorhanden
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
WHERE routine_name IN ('map_images_postgis', 'map_images_postgis_simple', 'map_images_postgis_bbox')
  AND routine_schema = 'public'
ORDER BY routine_name;

-- 6. Viewport-Karte (FullscreenMap): eine Abfrage pro sichtbarem Bereich, hart begrenzt
-- Benötigt dieselben Spalten auf items wie die Geo-Erweiterung (canonical_path, country_slug, …).
DROP FUNCTION IF EXISTS map_images_postgis_bbox(
  DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  INTEGER
);

CREATE OR REPLACE FUNCTION map_images_postgis_bbox(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  current_user_id TEXT DEFAULT NULL,
  user_filter_id TEXT DEFAULT NULL,
  location_filter_lat DOUBLE PRECISION DEFAULT NULL,
  location_filter_lon DOUBLE PRECISION DEFAULT NULL,
  min_lat DOUBLE PRECISION DEFAULT -90,
  max_lat DOUBLE PRECISION DEFAULT 90,
  min_lon DOUBLE PRECISION DEFAULT -180,
  max_lon DOUBLE PRECISION DEFAULT 180,
  max_results INTEGER DEFAULT 8000
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
  profile_id UUID,
  canonical_path TEXT,
  country_slug TEXT,
  state_slug TEXT,
  region_slug TEXT,
  district_slug TEXT,
  municipality_slug TEXT
)
AS $$
DECLARE
  user_uuid UUID;
  filter_user_uuid UUID;
  effective_lat DOUBLE PRECISION;
  effective_lon DOUBLE PRECISION;
  lim INTEGER;
  sort_lat DOUBLE PRECISION;
  sort_lon DOUBLE PRECISION;
BEGIN
  IF current_user_id IS NOT NULL AND current_user_id != '' THEN
    user_uuid := current_user_id::UUID;
  ELSE
    user_uuid := NULL;
  END IF;

  IF user_filter_id IS NOT NULL AND user_filter_id != '' THEN
    filter_user_uuid := user_filter_id::UUID;
  ELSE
    filter_user_uuid := NULL;
  END IF;

  IF location_filter_lat IS NOT NULL AND location_filter_lon IS NOT NULL THEN
    effective_lat := location_filter_lat;
    effective_lon := location_filter_lon;
  ELSE
    effective_lat := user_lat;
    effective_lon := user_lon;
  END IF;

  lim := GREATEST(1, LEAST(COALESCE(max_results, 8000), 50000));

  IF effective_lat IS DISTINCT FROM 0 OR effective_lon IS DISTINCT FROM 0 THEN
    sort_lat := effective_lat;
    sort_lon := effective_lon;
  ELSE
    sort_lat := (min_lat + max_lat) / 2.0;
    IF min_lon <= max_lon THEN
      sort_lon := (min_lon + max_lon) / 2.0;
    ELSE
      sort_lon := min_lon;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.path_64,
    i.title,
    i.lat,
    i.lon,
    ST_Distance(
      ST_MakePoint(sort_lon, sort_lat)::geography,
      ST_MakePoint(i.lon, i.lat)::geography
    ) AS distance,
    i.is_private,
    i.profile_id,
    i.canonical_path,
    i.country_slug,
    i.state_slug,
    i.region_slug,
    i.district_slug,
    i.municipality_slug
  FROM items i
  WHERE i.path_512 IS NOT NULL
    AND i.gallery = true
    AND i.lat IS NOT NULL
    AND i.lon IS NOT NULL
    AND i.path_64 IS NOT NULL
    AND i.lat >= min_lat AND i.lat <= max_lat
    AND (
      (min_lon <= max_lon AND i.lon >= min_lon AND i.lon <= max_lon)
      OR
      (min_lon > max_lon AND (i.lon >= min_lon OR i.lon <= max_lon))
    )
    AND (
      (filter_user_uuid IS NOT NULL AND i.profile_id = filter_user_uuid)
      OR
      (filter_user_uuid IS NULL AND (
        (user_uuid IS NOT NULL AND (i.profile_id = user_uuid OR i.is_private = false OR i.is_private IS NULL))
        OR
        (user_uuid IS NULL AND (i.is_private = false OR i.is_private IS NULL))
      ))
    )
  ORDER BY
    ST_MakePoint(i.lon, i.lat)::geography <-> ST_MakePoint(sort_lon, sort_lat)::geography
  LIMIT lim;
END;
$$ LANGUAGE plpgsql STABLE;