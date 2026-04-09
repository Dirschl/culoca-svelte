-- Erweitert map_images_postgis / map_images_postgis_simple um Felder für öffentliche Item-URLs
-- (canonical_path + Geo-Slugs). In Supabase SQL Editor ausführen, wenn die Funktionen der
-- Pagination-Variante (8 bzw. 5 Parameter) entsprechen.
--
-- Vorher: RETURNS nur id, slug, path_64, title, lat, lon, distance, …
-- Nachher: + canonical_path, country_slug, state_slug, region_slug, district_slug, municipality_slug
--
-- Zuerst die in Produktion üblichen Signaturen droppen (sonst 42P13: cannot change return type).

DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS map_images_postgis_simple(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS map_images_postgis_simple(DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP FUNCTION IF EXISTS map_images_postgis_simple(DOUBLE PRECISION, DOUBLE PRECISION, TEXT);
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT);
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);

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
  offset_value INTEGER;
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
    AND (
      (filter_user_uuid IS NOT NULL AND i.profile_id = filter_user_uuid)
      OR
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
  distance DOUBLE PRECISION,
  canonical_path TEXT,
  country_slug TEXT,
  state_slug TEXT,
  region_slug TEXT,
  district_slug TEXT,
  municipality_slug TEXT
)
AS $$
DECLARE
  offset_value INTEGER;
BEGIN
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
    END AS distance,
    i.canonical_path,
    i.country_slug,
    i.state_slug,
    i.region_slug,
    i.district_slug,
    i.municipality_slug
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
