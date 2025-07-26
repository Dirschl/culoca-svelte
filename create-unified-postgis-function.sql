-- Einheitliche PostGIS-Funktion für normale Galerie UND Suche
-- Für beide Fälle mit effizienter GPS-Entfernungsberechnung

-- Bestehende Funktionen löschen
DROP FUNCTION IF EXISTS gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text);

-- Einheitliche PostGIS-Funktion erstellen
CREATE OR REPLACE FUNCTION gallery_items_unified_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 50,
  current_user_id UUID DEFAULT NULL,
  search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title CHARACTER VARYING(255),
  description CHARACTER VARYING(255),
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
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        ST_Distance(
          ST_MakePoint(user_lon, user_lat)::geography,
          ST_MakePoint(i.lon, i.lat)::geography
        )
      ELSE
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
    AND (
      -- Suchfilter: Wenn search_term vorhanden, dann suchen
      CASE
        WHEN search_term IS NOT NULL AND search_term != '' THEN
          i.title ILIKE '%' || search_term || '%' OR 
          i.description ILIKE '%' || search_term || '%'
        ELSE
          TRUE -- Keine Suche, alle Items
      END
    )
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$$ LANGUAGE plpgsql; 