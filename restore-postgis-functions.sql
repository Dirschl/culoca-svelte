-- Restore PostGIS Functions for Culoca Frontend
-- Based on the user's Supabase database dump

-- 1. Create gallery_items_normal_postgis (renamed from gallery_items_normal_rpc)
CREATE OR REPLACE FUNCTION public.gallery_items_normal_postgis(user_lat double precision DEFAULT 0, user_lon double precision DEFAULT 0, page_value integer DEFAULT 0, page_size_value integer DEFAULT 50, current_user_id uuid DEFAULT NULL::uuid) 
RETURNS TABLE(id uuid, slug text, title text, description text, lat double precision, lon double precision, path_512 text, path_2048 text, path_64 text, width integer, height integer, created_at timestamp with time zone, profile_id uuid, user_id uuid, is_private boolean, gallery boolean, keywords text[], original_name text, distance double precision, total_count bigint)
LANGUAGE plpgsql
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
    -- GPS-Entfernungsberechnung direkt in PostgreSQL
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        -- Haversine-Formel für Entfernungsberechnung
        6371000 * acos(
          cos(radians(user_lat)) * cos(radians(i.lat)) * cos(radians(i.lon) - radians(user_lon)) +
          sin(radians(user_lat)) * sin(radians(i.lat))
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
$$;

-- 2. Create gallery_items_unified_postgis (already exists in dump)
CREATE OR REPLACE FUNCTION public.gallery_items_unified_postgis(user_lat double precision DEFAULT 0, user_lon double precision DEFAULT 0, page_value integer DEFAULT 0, page_size_value integer DEFAULT 50, current_user_id uuid DEFAULT NULL::uuid, search_term text DEFAULT NULL::text, location_filter_lat double precision DEFAULT NULL::double precision, location_filter_lon double precision DEFAULT NULL::double precision) 
RETURNS TABLE(id uuid, slug text, title character varying, description character varying, lat double precision, lon double precision, path_512 text, path_2048 text, path_64 text, width integer, height integer, created_at timestamp with time zone, profile_id uuid, user_id uuid, is_private boolean, gallery boolean, keywords text[], original_name text, distance double precision, total_count bigint)
LANGUAGE plpgsql
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
$$;

-- 3. Create get_images_by_distance_simple (already exists in dump)
CREATE OR REPLACE FUNCTION public.get_images_by_distance_simple(filter_lat double precision, filter_lon double precision) 
RETURNS TABLE(id text, path_512 text, path_2048 text, path_64 text, width integer, height integer, lat double precision, lon double precision, title text, description text, distance double precision)
LANGUAGE plpgsql
AS $$
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
    -- Haversine formula for distance calculation in meters
    (6371000 * acos(
      cos(radians(filter_lat)) * 
      cos(radians(i.lat)) * 
      cos(radians(i.lon) - radians(filter_lon)) + 
      sin(radians(filter_lat)) * 
      sin(radians(i.lat))
    )) as distance
  FROM items i
  WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL
    AND i.path_512 IS NOT NULL
  ORDER BY distance ASC;
END;
$$;

-- Grant permissions to the functions
GRANT EXECUTE ON FUNCTION public.gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gallery_items_unified_postgis(double precision, double precision, integer, integer, uuid, text, double precision, double precision) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_images_by_distance_simple(double precision, double precision) TO anon, authenticated, service_role;

-- Set ownership
ALTER FUNCTION public.gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid) OWNER TO postgres;
ALTER FUNCTION public.gallery_items_unified_postgis(double precision, double precision, integer, integer, uuid, text, double precision, double precision) OWNER TO postgres;
ALTER FUNCTION public.get_images_by_distance_simple(double precision, double precision) OWNER TO postgres; 