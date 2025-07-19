-- Unbegrenzte Funktion für alle Bilder sortiert nach Entfernung
-- Lädt ALLE Bilder und sortiert sie nach Entfernung vom Filter-Punkt

CREATE OR REPLACE FUNCTION images_by_distance_unlimited(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION
)
RETURNS TABLE (
  id TEXT,
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
  distance DOUBLE PRECISION,
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
    )) as distance,
    i.created_at
  FROM items i
  WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL
    AND i.path_512 IS NOT NULL
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql; 