-- Test PostGIS Verfügbarkeit und erstelle die Funktion
-- Prüfe ob PostGIS Extension verfügbar ist
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'postgis'
    ) THEN 'PostGIS ist bereits aktiviert'
    ELSE 'PostGIS ist nicht aktiviert'
  END AS postgis_status;

-- Versuche PostGIS Extension zu aktivieren
CREATE EXTENSION IF NOT EXISTS postgis;

-- Teste PostGIS Funktionen
SELECT 
  ST_Distance(
    ST_MakePoint(12.718432453710898, 48.31936293566058)::geography,
    ST_MakePoint(12.7158583333333, 48.3219866666667)::geography
  ) AS test_distance;

-- Bestehende Funktionen löschen
DROP FUNCTION IF EXISTS gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text);
DROP FUNCTION IF EXISTS gallery_items_unified_postgis(double precision, double precision, integer, integer, uuid, text);

-- Erweiterte einheitliche PostGIS-Funktion mit LocationFilter-Unterstützung
CREATE OR REPLACE FUNCTION gallery_items_unified_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 50,
  current_user_id UUID DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  location_filter_lat DOUBLE PRECISION DEFAULT NULL,
  location_filter_lon DOUBLE PRECISION DEFAULT NULL
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
  -- Bestimme die effektiven GPS-Koordinaten (LocationFilter hat Vorrang)
  DECLARE
    effective_lat DOUBLE PRECISION;
    effective_lon DOUBLE PRECISION;
  BEGIN
    -- LocationFilter hat Vorrang über user_lat/user_lon
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
        WHEN effective_lat != 0 AND effective_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
          ST_Distance(
            ST_MakePoint(effective_lon, effective_lat)::geography,
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
        CASE
          WHEN search_term IS NOT NULL AND search_term != '' THEN
            i.title ILIKE '%' || search_term || '%' OR 
            i.description ILIKE '%' || search_term || '%'
          ELSE
            TRUE
        END
      )
    ORDER BY distance ASC
    OFFSET (page_value * page_size_value)
    LIMIT page_size_value;
  END;
END;
$$ LANGUAGE plpgsql; 