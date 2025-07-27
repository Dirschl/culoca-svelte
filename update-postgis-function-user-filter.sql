-- Update PostGIS function to support user filtering
-- Run this in Supabase SQL Editor

-- Drop existing function
DROP FUNCTION IF EXISTS gallery_items_unified_postgis(double precision, double precision, integer, integer, uuid, text, double precision, double precision);

-- Create updated function with user filter support
CREATE OR REPLACE FUNCTION gallery_items_unified_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 50,
  current_user_id UUID DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  location_filter_lat DOUBLE PRECISION DEFAULT NULL,
  location_filter_lon DOUBLE PRECISION DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL
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
  WITH items_with_distance AS (
    SELECT
      i.*,
      -- WICHTIG: Entfernungsberechnung zur übergebenen GPS-Koordinate
      CASE
        WHEN (location_filter_lat IS NOT NULL AND location_filter_lon IS NOT NULL) THEN
          -- LocationFilter hat Vorrang
          CASE
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
              ST_Distance(
                ST_MakePoint(location_filter_lon, location_filter_lat)::geography,
                ST_MakePoint(i.lon, i.lat)::geography
              )
            ELSE
              999999999
          END
        WHEN (user_lat != 0 AND user_lon != 0) THEN
          -- Normale GPS-Koordinaten
          CASE
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
              ST_Distance(
                ST_MakePoint(user_lon, user_lat)::geography,
                ST_MakePoint(i.lon, i.lat)::geography
              )
            ELSE
              999999999
          END
        ELSE
          -- Keine GPS-Koordinaten verfügbar
          999999999
      END AS distance,
      COUNT(*) OVER() AS total_count
    FROM items i
    WHERE i.path_512 IS NOT NULL
      AND i.gallery = true
      AND (
        -- User-Filter: Wenn filter_user_id gesetzt, nur Bilder dieses Users
        CASE
          WHEN filter_user_id IS NOT NULL THEN
            i.profile_id = filter_user_id
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
  )
  SELECT
    id,
    slug,
    title,
    description,
    lat,
    lon,
    path_512,
    path_2048,
    path_64,
    width,
    height,
    created_at,
    profile_id,
    user_id,
    is_private,
    gallery,
    keywords,
    original_name,
    distance,
    total_count
  FROM items_with_distance
  -- WICHTIG: Sortierung nach Entfernung aufsteigend (näheste zuerst)
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$$ LANGUAGE plpgsql; 