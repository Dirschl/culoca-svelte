-- Vereinfachte PostGIS-Funktion für Kartenansicht mit korrekten Datentypen
-- Weniger anfällig für Fehler, einfachere Logik

CREATE OR REPLACE FUNCTION map_images_postgis_simple(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  current_user_id UUID DEFAULT NULL
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
BEGIN
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
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql; 