-- Viewport-basierte Kartenabfrage: ein RPC pro sichtbarem Bereich (max. max_results Zeilen).
-- In Supabase SQL Editor ausführen.
--
-- Performance bei sehr großen Tabellen: GiST auf Geographie (optional, CONCURRENTLY):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS items_gallery_geog_knn_idx
--   ON items USING GIST ((ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography))
--   WHERE gallery = true AND path_512 IS NOT NULL AND path_64 IS NOT NULL
--     AND lat IS NOT NULL AND lon IS NOT NULL;

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

  -- Sortierzentrum: GPS/Filter, sonst Mitte der Bounding Box
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

COMMENT ON FUNCTION map_images_postgis_bbox IS
  'Map: items in lat/lon bbox, KNN order by distance to center, hard cap.';
