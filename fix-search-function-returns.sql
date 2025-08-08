-- =====================================================
-- FIX SEARCH FUNCTION RETURNS TABLE DEFINITION
-- =====================================================

-- This script fixes the RETURNS TABLE definition to match the actual returned columns
-- The function now returns caption and original_name, so we need to update the definition

-- Drop and recreate the function with correct RETURNS TABLE definition
DROP FUNCTION IF EXISTS public.gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.gallery_items_search_postgis(
  user_lat double precision DEFAULT 0,
  user_lon double precision DEFAULT 0,
  page_value integer DEFAULT 0,
  page_size_value integer DEFAULT 50,
  current_user_id uuid DEFAULT NULL::uuid,
  search_term text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, 
  slug text, 
  title text, 
  description text, 
  lat double precision, 
  lon double precision, 
  path_512 text, 
  path_2048 text, 
  path_64 text, 
  width integer, 
  height integer, 
  created_at timestamp with time zone, 
  profile_id uuid, 
  user_id uuid, 
  is_private boolean, 
  gallery boolean, 
  keywords text[], 
  caption text,
  original_name text,
  distance double precision, 
  total_count bigint
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.title::text,
    i.description::text,
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
    i.caption,
    i.original_name,
    -- GPS-Entfernungsberechnung direkt in PostgreSQL mit PostGIS
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        -- PostGIS ST_Distance für präzise Entfernungsberechnung
        ST_Distance(
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(i.lon, i.lat), 4326)::geography
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
        -- Wenn current_user_id gesetzt ist: Zeige NUR Items des Users (User-Filter)
        WHEN current_user_id IS NOT NULL THEN
          i.profile_id = current_user_id
        -- Wenn kein current_user_id: Nur öffentliche Items
        ELSE
          i.is_private = false OR i.is_private IS NULL
      END
    )
    AND (
      -- Suchfilter: Wenn search_term vorhanden, dann suchen
      CASE
        WHEN search_term IS NOT NULL AND search_term != '' THEN
          -- NEU: Verwende ILIKE mit AND-Logik für flexible Teilwort-Suche
          -- Für "mühl bahnhof" → (title ILIKE '%mühl%' OR caption ILIKE '%mühl%' OR description ILIKE '%mühl%') 
          -- AND (title ILIKE '%bahnhof%' OR caption ILIKE '%bahnhof%' OR description ILIKE '%bahnhof%')
          (
            i.title ILIKE '%' || split_part(search_term, ' ', 1) || '%' OR 
            i.caption ILIKE '%' || split_part(search_term, ' ', 1) || '%' OR 
            i.description ILIKE '%' || split_part(search_term, ' ', 1) || '%' OR
            i.original_name ILIKE '%' || split_part(search_term, ' ', 1) || '%'
          )
          AND (
            CASE 
              WHEN split_part(search_term, ' ', 2) != '' THEN
                (i.title ILIKE '%' || split_part(search_term, ' ', 2) || '%' OR 
                 i.caption ILIKE '%' || split_part(search_term, ' ', 2) || '%' OR 
                 i.description ILIKE '%' || split_part(search_term, ' ', 2) || '%' OR
                 i.original_name ILIKE '%' || split_part(search_term, ' ', 2) || '%')
              ELSE TRUE
            END
          )
          AND (
            CASE 
              WHEN split_part(search_term, ' ', 3) != '' THEN
                (i.title ILIKE '%' || split_part(search_term, ' ', 3) || '%' OR 
                 i.caption ILIKE '%' || split_part(search_term, ' ', 3) || '%' OR 
                 i.description ILIKE '%' || split_part(search_term, ' ', 3) || '%' OR
                 i.original_name ILIKE '%' || split_part(search_term, ' ', 3) || '%')
              ELSE TRUE
            END
          )
        ELSE
          TRUE -- Keine Suche, alle Items
      END
    )
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text) TO anon, authenticated, service_role;

-- Set ownership
ALTER FUNCTION public.gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text) OWNER TO postgres;

-- Test the updated function
SELECT title, original_name, caption, slug 
FROM gallery_items_search_postgis(0, 0, 0, 5, NULL, 'test')
LIMIT 3;
