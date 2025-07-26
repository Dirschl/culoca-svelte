-- PostGIS-Funktion mit vollständiger Filter-Unterstützung für FullscreenMap
-- Berücksichtigt userFilter, locationFilter und privacy filtering

-- 1. Lösche die alte Funktion
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT);

-- 2. Erstelle die neue erweiterte Funktion mit Filter-Parametern
CREATE OR REPLACE FUNCTION map_images_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  current_user_id TEXT DEFAULT NULL,
  user_filter_id TEXT DEFAULT NULL,
  location_filter_lat DOUBLE PRECISION DEFAULT NULL,
  location_filter_lon DOUBLE PRECISION DEFAULT NULL
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
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;

-- 3. Teste die Funktion mit verschiedenen Szenarien
-- Test 1: Alle öffentlichen Bilder (anonym)
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, NULL, NULL, NULL, NULL);

-- Test 2: Alle Bilder für eingeloggten User
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, 'test-user-id', NULL, NULL, NULL);

-- Test 3: Bilder eines spezifischen Users (User-Filter)
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, 'test-user-id', 'specific-user-id', NULL, NULL);

-- Test 4: Mit Location-Filter
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, 'test-user-id', NULL, 48.31935474592246, 12.718470382407554); 