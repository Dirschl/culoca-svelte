-- Unbegrenzte PostGIS-Funktion für Kartenansicht
-- Entfernt alle internen Limits

-- 1. Lösche die alte Funktion
DROP FUNCTION IF EXISTS map_images_postgis(DOUBLE PRECISION, DOUBLE PRECISION, TEXT);

-- 2. Erstelle die neue unbegrenzte Funktion
CREATE OR REPLACE FUNCTION map_images_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  current_user_id TEXT DEFAULT NULL
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
BEGIN
  -- Convert TEXT to UUID if provided
  IF current_user_id IS NOT NULL AND current_user_id != '' THEN
    user_uuid := current_user_id::UUID;
  ELSE
    user_uuid := NULL;
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
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        ST_Distance(
          ST_MakePoint(user_lon, user_lat)::geography,
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
      (user_uuid IS NOT NULL AND (i.profile_id = user_uuid OR i.is_private = false OR i.is_private IS NULL))
      OR
      (user_uuid IS NULL AND (i.is_private = false OR i.is_private IS NULL))
    )
  ORDER BY distance ASC;
  -- KEIN LIMIT - lädt alle passenden Datensätze
END;
$$ LANGUAGE plpgsql;

-- 3. Teste die Funktion
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, NULL);
SELECT COUNT(*) as total_images FROM map_images_postgis(0, 0, ''); 