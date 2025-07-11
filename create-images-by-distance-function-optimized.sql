-- Optimierte Funktion für effizientes Laden der nähesten Bilder
-- Lädt die 100 nähesten Bilder im 5km Radius und sortiert sie nach Entfernung

CREATE OR REPLACE FUNCTION images_by_distance_optimized(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  max_radius_meters INTEGER DEFAULT 5000,
  max_results INTEGER DEFAULT 100
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
    ST_Distance(
      ST_Transform(ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326), 3857),
      ST_Transform(ST_SetSRID(ST_MakePoint(i.lon, i.lat), 3857), 3857)
    ) as distance,
    i.created_at
  FROM items i
  WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL
    AND i.path_512 IS NOT NULL
    AND ST_Distance(
      ST_Transform(ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326), 3857),
      ST_Transform(ST_SetSRID(ST_MakePoint(i.lon, i.lat), 3857), 3857)
    ) <= max_radius_meters
  ORDER BY distance ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql; 