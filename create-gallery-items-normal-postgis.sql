-- PostGIS Extension aktivieren (falls noch nicht aktiviert)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Gallery Items Normal PostGIS RPC Function
-- Für die normale Galerie mit effizienter GPS-Entfernungsberechnung
CREATE OR REPLACE FUNCTION gallery_items_normal_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 50,
  current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  path_512 TEXT,
  path_2048 TEXT,
  path_64 TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  profile_id UUID,
  user_id UUID,
  is_private BOOLEAN,
  gallery BOOLEAN,
  keywords TEXT[],
  original_name TEXT,
  distance DOUBLE PRECISION,
  total_count BIGINT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.title,
    i.description,
    i.lat,
    i.lon,
    i.path_512,
    i.path_2048,
    i.path_64,
    i.width,
    i.height,
    i.created_at,
    i.profile_id,
    i.user_id,
    i.is_private,
    i.gallery,
    i.keywords,
    i.original_name,
    -- PostGIS-basierte Entfernungsberechnung (viel effizienter)
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        -- PostGIS ST_Distance für präzise Entfernungsberechnung
        ST_Distance(
          ST_MakePoint(user_lon, user_lat)::geography,
          ST_MakePoint(i.lon, i.lat)::geography
        )
      ELSE
        -- Items ohne GPS oder ohne User-Koordinaten bekommen maximale Entfernung
        999999999
    END AS distance,
    COUNT(*) OVER() AS total_count
  FROM items i
  WHERE i.path_512 IS NOT NULL
    AND i.gallery = true
    AND (
      CASE
        WHEN current_user_id IS NOT NULL THEN
          i.profile_id = current_user_id OR i.is_private = false OR i.is_private IS NULL
        ELSE
          i.is_private = false OR i.is_private IS NULL
      END
    )
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$$ LANGUAGE plpgsql; 